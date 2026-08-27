import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { LocalAdapter } from "../adapters/local/local-adapter";
import { resetLocalDatabase } from "../adapters/local/maintenance";
import {
  exportWaslTransfer,
  previewWaslTransfer,
  importWaslTransfer,
  extractStoreEntities,
} from "./transfer";
import { getStoreVersion } from "../store-registry";
import type { WaslBackup, NotesPersistedState, GoalsPersistedState } from "../types";

describe("Selective Transfer Engine (.wasl-transfer)", () => {
  let adapterA: LocalAdapter;
  let adapterB: LocalAdapter;

  beforeEach(async () => {
    await resetLocalDatabase("wasl-transfer-test-a");
    await resetLocalDatabase("wasl-transfer-test-b");
    adapterA = new LocalAdapter("wasl-transfer-test-a");
    adapterB = new LocalAdapter("wasl-transfer-test-b");
    await adapterA.initialize();
    await adapterB.initialize();
  });

  it("extracts entities correctly from various domain stores", () => {
    const notesEntities = extractStoreEntities("lifeos-notes", {
      notes: [{ id: "n1", title: "Note 1" }, { id: "n2", title: "Note 2" }],
      categories: [{ id: "c1", name: "Work" }],
    });
    expect(notesEntities).toHaveLength(2);
    expect(notesEntities.map((e) => e.id)).toEqual(["n1", "n2"]);

    const tasksEntities = extractStoreEntities("lifeos-tasks", {
      tasks: [{ id: "t1", title: "Task 1" }],
      dailyFocus: {},
    });
    expect(tasksEntities).toHaveLength(1);
    expect(tasksEntities[0].id).toBe("t1");

    const healthEntities = extractStoreEntities("lifeos-health", {
      workouts: [{ id: "w1", title: "Leg Day", sport: "Gym" }],
      programs: [{ id: "p1", name: "PPL" }],
      exercises: [{ id: "e1", name: "Squat", category: "Gym" }],
      days: {},
    });
    expect(healthEntities).toHaveLength(3);
    expect(healthEntities.map((h) => h.id)).toEqual(["w1", "p1", "e1"]);
  });

  it("selectively exports whole domains and specific entity IDs", async () => {
    // Populate source adapterA
    await adapterA.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: {
        notes: [
          { id: "note-1", title: "Note 1", body: "Body 1", tag: "note", pinned: false, updatedAt: 1767225600000 },
          { id: "note-2", title: "Note 2", body: "Body 2", tag: "note", pinned: false, updatedAt: 1767225600000 },
        ],
        categories: [],
      },
      updatedAt: new Date().toISOString(),
    });

    await adapterA.putStore({
      store: "lifeos-goals",
      version: getStoreVersion("lifeos-goals"),
      state: {
        goals: [
          { id: "goal-1", title: "Goal 1", category: "career", plan: "", manualProgress: 50, completed: false, milestones: [] },
          { id: "goal-2", title: "Goal 2", category: "health", plan: "", manualProgress: 10, completed: false, milestones: [] },
        ],
      },
      updatedAt: new Date().toISOString(),
    });

    // 1. Export only note-1 and entire lifeos-goals domain
    const { transfer } = await exportWaslTransfer(adapterA, {
      domains: ["lifeos-goals"],
      entities: {
        "lifeos-notes": ["note-1"],
      },
    });

    expect(transfer.format).toBe("wasl-selective-transfer");
    expect(transfer.formatVersion).toBe(1);
    expect(transfer.stores).toHaveLength(2);

    const notesDoc = transfer.stores.find((s) => s.store === "lifeos-notes");
    const notesState = notesDoc?.state as NotesPersistedState;
    expect(notesState.notes).toHaveLength(1);
    expect(notesState.notes[0].id).toBe("note-1");

    const goalsDoc = transfer.stores.find((s) => s.store === "lifeos-goals");
    const goalsState = goalsDoc?.state as GoalsPersistedState;
    expect(goalsState.goals).toHaveLength(2);

    // Source adapterA was NEVER mutated
    const currentA = await adapterA.getStore("lifeos-notes");
    const currentNotesState = currentA?.state as NotesPersistedState;
    expect(currentNotesState?.notes).toHaveLength(2);
  });

  it("previews transfer with checksum validation and detects missing cross-domain dependencies", async () => {
    // Adapter B has no goals
    await adapterB.putStore({
      store: "lifeos-goals",
      version: getStoreVersion("lifeos-goals"),
      state: { goals: [] },
      updatedAt: new Date().toISOString(),
    });

    // Transfer contains a task referencing a missing goal
    const { transfer } = await exportWaslTransfer(adapterA, {
      domains: [],
    });

    // Create a manual transfer payload with task referencing missing goal
    const { checksum: _oldChecksum, ...transferWithoutChecksum } = transfer;
    const transferWithDep = {
      ...transferWithoutChecksum,
      stores: [
        {
          store: "lifeos-tasks" as const,
          version: getStoreVersion("lifeos-tasks"),
          state: {
            tasks: [
              { id: "task-1", title: "Complete Proposal", goalId: "missing-goal-123", status: "todo", priority: "high", createdAt: "2026-01-01" },
            ],
            dailyFocus: {},
          },
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    // Calculate checksum for it
    const { calculateBackupChecksum } = await import("./canonical");
    const checksum = await calculateBackupChecksum(
      transferWithDep as unknown as Omit<WaslBackup, "checksum">,
    );
    const validTransfer = { ...transferWithDep, checksum };

    const preview = await previewWaslTransfer(validTransfer, adapterB);
    expect(preview.valid).toBe(true);
    expect(preview.dependencyWarnings.length).toBeGreaterThan(0);
    expect(preview.dependencyWarnings[0]).toContain("missing-goal-123");
  });

  it("merges transfer into destination with 'skip' duplicate strategy", async () => {
    // Setup destination B with existing Note 1
    await adapterB.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: {
        notes: [
          { id: "note-1", title: "Original Note 1", body: "Original Body", tag: "note", pinned: false, updatedAt: 1767225600000 },
        ],
        categories: [],
      },
      updatedAt: new Date().toISOString(),
    });

    // Setup incoming transfer with updated Note 1 and new Note 2
    await adapterA.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: {
        notes: [
          { id: "note-1", title: "Updated Note 1", body: "Modified Body", tag: "note", pinned: false, updatedAt: 1767225600000 },
          { id: "note-2", title: "New Note 2", body: "New Body", tag: "note", pinned: false, updatedAt: 1767225600000 },
        ],
        categories: [],
      },
      updatedAt: new Date().toISOString(),
    });

    const { transfer } = await exportWaslTransfer(adapterA, {
      domains: ["lifeos-notes"],
    });

    const result = await importWaslTransfer(adapterB, transfer, { strategy: "skip" });
    expect(result.success).toBe(true);
    expect(result.entitiesImported).toBe(1); // note-2
    expect(result.entitiesSkipped).toBe(1); // note-1

    const finalB = await adapterB.getStore("lifeos-notes");
    const finalBNotesState = finalB?.state as NotesPersistedState;
    expect(finalBNotesState?.notes).toHaveLength(2);
    // note-1 was NOT overwritten
    expect(finalBNotesState?.notes.find((n) => n.id === "note-1")?.title).toBe("Original Note 1");
    // note-2 was added
    expect(finalBNotesState?.notes.find((n) => n.id === "note-2")?.title).toBe("New Note 2");
  });

  it("merges transfer into destination with 'replace' duplicate strategy", async () => {
    // Setup destination B with existing Note 1
    await adapterB.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: {
        notes: [
          { id: "note-1", title: "Original Note 1", body: "Original Body", tag: "note", pinned: false, updatedAt: 1767225600000 },
        ],
        categories: [],
      },
      updatedAt: new Date().toISOString(),
    });

    // Setup incoming transfer
    await adapterA.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: {
        notes: [
          { id: "note-1", title: "Updated Note 1", body: "Modified Body", tag: "note", pinned: false, updatedAt: 1767225600000 },
          { id: "note-2", title: "New Note 2", body: "New Body", tag: "note", pinned: false, updatedAt: 1767225600000 },
        ],
        categories: [],
      },
      updatedAt: new Date().toISOString(),
    });

    const { transfer } = await exportWaslTransfer(adapterA, {
      domains: ["lifeos-notes"],
    });

    const result = await importWaslTransfer(adapterB, transfer, { strategy: "replace" });
    expect(result.success).toBe(true);
    expect(result.entitiesReplaced).toBe(1); // note-1
    expect(result.entitiesImported).toBe(1); // note-2

    const finalB = await adapterB.getStore("lifeos-notes");
    const finalBNotesState = finalB?.state as NotesPersistedState;
    expect(finalBNotesState?.notes).toHaveLength(2);
    // note-1 was replaced
    expect(finalBNotesState?.notes.find((n) => n.id === "note-1")?.title).toBe("Updated Note 1");
  });

  it("merges transfer into destination with 'copy' duplicate strategy", async () => {
    // Setup destination B with existing Note 1
    await adapterB.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: {
        notes: [
          { id: "note-1", title: "My Note", body: "Original Body", tag: "note", pinned: false, updatedAt: 1767225600000 },
        ],
        categories: [],
      },
      updatedAt: new Date().toISOString(),
    });

    // Setup incoming transfer
    await adapterA.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: {
        notes: [
          { id: "note-1", title: "My Note", body: "Incoming Body", tag: "note", pinned: false, updatedAt: 1767225600000 },
        ],
        categories: [],
      },
      updatedAt: new Date().toISOString(),
    });

    const { transfer } = await exportWaslTransfer(adapterA, {
      domains: ["lifeos-notes"],
    });

    const result = await importWaslTransfer(adapterB, transfer, { strategy: "copy" });
    expect(result.success).toBe(true);
    expect(result.entitiesCopied).toBe(1);

    const finalB = await adapterB.getStore("lifeos-notes");
    const finalBNotesState = finalB?.state as NotesPersistedState;
    expect(finalBNotesState?.notes).toHaveLength(2);
    expect(finalBNotesState?.notes[0].id).toBe("note-1");
    expect(finalBNotesState?.notes[0].title).toBe("My Note");

    // The copy has a new unique ID and "(Copy)" suffix
    expect(finalBNotesState?.notes[1].id).toContain("note-1-copy");
    expect(finalBNotesState?.notes[1].title).toBe("My Note (Copy)");
  });
});
