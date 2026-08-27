import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalAdapter } from "../adapters/local/local-adapter";
import {
  canonicalizeJson,
  calculateBackupChecksum,
  verifyBackupChecksum,
} from "./canonical";
import { exportWaslBackup } from "./export";
import { previewWaslBackup, MAX_BACKUP_SIZE_BYTES } from "./preview";
import { importWaslBackupToLocal, LocalDatabaseNotEmptyError } from "./import";
import {
  detectLegacyLocalStorage,
  convertLegacyStorageToBackup,
  parseLegacyStorageKey,
} from "./legacy-import";
import { getStoreVersion, type StoreKey } from "../store-registry";
import type { WaslBackup, StoreDocument, DataAdapter } from "../types";

function createSyntheticFullBackup(): WaslBackup {
  const stores: StoreDocument<StoreKey>[] = [
    {
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: {
        notes: [
          { id: "n1", title: "Test Note", body: "Hello Wasl", tag: "note", updatedAt: 123456789, pinned: false },
        ],
        categories: [{ id: "c1", name: "Personal", color: "#blue" }],
      },
      updatedAt: "2026-08-23T12:00:00.000Z",
    },
    {
      store: "lifeos-tasks",
      version: getStoreVersion("lifeos-tasks"),
      state: {
        tasks: [
          { id: "t1", title: "Test Task", status: "todo", priority: "high", today: true, createdAt: "2026-08-23" },
        ],
        dailyFocus: { "2026-08-23": ["t1"] },
      },
      updatedAt: "2026-08-23T12:00:00.000Z",
    },
  ];

  const payloadWithoutChecksum: Omit<WaslBackup, "checksum"> = {
    format: "wasl-portable-backup",
    formatVersion: 1,
    appVersion: "0.1.0",
    exportedAt: "2026-08-23T12:00:00.000Z",
    sourceEdition: "local",
    stores,
    preferences: { theme: "graphite" },
  };

  // Synchronous placeholder or test checksum
  return {
    ...payloadWithoutChecksum,
    checksum: "0".repeat(64),
  };
}

describe("Canonical JSON & SHA-256 Checksum", () => {
  it("sorts object keys alphabetically regardless of input insertion order", () => {
    const objA = { b: 2, a: 1, z: { d: 4, c: 3 } };
    const objB = { z: { c: 3, d: 4 }, a: 1, b: 2 };

    expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB));
    expect(canonicalizeJson(objA)).toBe('{"a":1,"b":2,"z":{"c":3,"d":4}}');
  });

  it("preserves array ordering strictly", () => {
    const arr1 = { items: ["first", "second", "third"] };
    const arr2 = { items: ["third", "second", "first"] };

    expect(canonicalizeJson(arr1)).not.toBe(canonicalizeJson(arr2));
  });

  it("computes and verifies untampered SHA-256 checksums", async () => {
    const backup = createSyntheticFullBackup();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { checksum: _, ...payload } = backup;
    const realChecksum = await calculateBackupChecksum(payload);

    const validBackup: WaslBackup = { ...payload, checksum: realChecksum };
    expect(await verifyBackupChecksum(validBackup)).toBe(true);

    // Tampering test: modify a note title
    const tamperedBackup: WaslBackup = structuredClone(validBackup);
    (tamperedBackup.stores[0].state as { notes: { title: string }[] }).notes[0].title = "Tampered Title";
    expect(await verifyBackupChecksum(tamperedBackup)).toBe(false);
  });
});

describe("Backup Preview Engine (Zero Database Writes)", () => {
  it("rejects files exceeding the 50 MiB maximum limit", async () => {
    const hugeFakeString = "x".repeat(MAX_BACKUP_SIZE_BYTES + 100);
    const preview = await previewWaslBackup(hugeFakeString);

    expect(preview.valid).toBe(false);
    expect(preview.errors[0]).toContain("exceeds maximum limit of 50 MiB");
  });

  it("rejects invalid JSON syntax with clear error", async () => {
    const preview = await previewWaslBackup("{ invalid json :::");
    expect(preview.valid).toBe(false);
    expect(preview.errors[0]).toContain("Invalid JSON");
  });

  it("previews a valid backup reporting entity counts, versions, and no errors", async () => {
    const backup = createSyntheticFullBackup();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { checksum: _, ...payload } = backup;
    const realChecksum = await calculateBackupChecksum(payload);
    const validBackup: WaslBackup = { ...payload, checksum: realChecksum };

    const preview = await previewWaslBackup(validBackup);
    expect(preview.valid).toBe(true);
    expect(preview.storeCount).toBe(2);
    expect(preview.stores).toHaveLength(2);
    expect(preview.stores[0].store).toBe("lifeos-notes");
    expect(preview.stores[0].entityCount).toBe(1);
    expect(preview.stores[1].store).toBe("lifeos-tasks");
    expect(preview.stores[1].entityCount).toBe(1);
    expect(preview.errors).toHaveLength(0);
  });

  it("identifies unsupported future schema versions as invalid", async () => {
    const backup = createSyntheticFullBackup();
    backup.stores[0].version = 999; // future version
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { checksum: _, ...payload } = backup;
    const realChecksum = await calculateBackupChecksum(payload);
    const futureBackup: WaslBackup = { ...payload, checksum: realChecksum };

    const preview = await previewWaslBackup(futureBackup);
    expect(preview.valid).toBe(false);
    expect(preview.errors.some((e) => e.includes("future version 999"))).toBe(true);
  });

  it("identifies malformed store states with exact property errors", async () => {
    const backup = createSyntheticFullBackup();
    // @ts-expect-error corrupting task priority to test domain validation
    backup.stores[1].state.tasks[0].priority = "ultra-urgent";
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { checksum: _, ...payload } = backup;
    const realChecksum = await calculateBackupChecksum(payload);
    const badBackup: WaslBackup = { ...payload, checksum: realChecksum };

    const preview = await previewWaslBackup(badBackup);
    expect(preview.valid).toBe(false);
    expect(preview.errors.some((e) => e.includes("[lifeos-tasks]"))).toBe(true);
  });
});

describe("Atomic Local Import & Content Parity", () => {
  let dbName: string;
  let adapter: LocalAdapter;

  beforeEach(() => {
    dbName = `wasl-import-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    adapter = new LocalAdapter({ databaseName: dbName });
  });

  afterEach(async () => {
    await adapter.close();
  });

  it("imports a valid backup into an empty Local database and verifies parity", async () => {
    const rawBackup = createSyntheticFullBackup();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { checksum: _, ...payload } = rawBackup;
    const realChecksum = await calculateBackupChecksum(payload);
    const validBackup: WaslBackup = { ...payload, checksum: realChecksum };

    const result = await importWaslBackupToLocal(validBackup, adapter);
    expect(result.success).toBe(true);
    expect(result.storesImported).toBe(2);

    const notesDoc = await adapter.getStore("lifeos-notes");
    expect(notesDoc?.state.notes[0].title).toBe("Test Note");

    const tasksDoc = await adapter.getStore("lifeos-tasks");
    expect(tasksDoc?.state.tasks[0].title).toBe("Test Task");
  });

  it("refuses import when local database already contains data", async () => {
    await adapter.initialize();
    await adapter.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: { notes: [], categories: [] },
      updatedAt: new Date().toISOString(),
    });

    const rawBackup = createSyntheticFullBackup();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { checksum: _, ...payload } = rawBackup;
    const realChecksum = await calculateBackupChecksum(payload);
    const validBackup: WaslBackup = { ...payload, checksum: realChecksum };

    await expect(importWaslBackupToLocal(validBackup, adapter)).rejects.toThrow(
      LocalDatabaseNotEmptyError,
    );
  });

  it("rolls back all changes atomically if an error occurs during import", async () => {
    const rawBackup = createSyntheticFullBackup();
    // Add invalid store state that fails domain validation
    rawBackup.stores.push({
      store: "lifeos-goals",
      version: getStoreVersion("lifeos-goals"),
      // @ts-expect-error corrupting goal to trigger transaction failure
      state: { goals: [{ id: "g1" }] }, // missing required title, plan, category, etc.
      updatedAt: new Date().toISOString(),
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { checksum: _, ...payload } = rawBackup;
    const realChecksum = await calculateBackupChecksum(payload);
    const badBackup: WaslBackup = { ...payload, checksum: realChecksum };

    await expect(importWaslBackupToLocal(badBackup, adapter)).rejects.toThrow(/validation failed/i);

    // Verify zero documents were committed (atomic rollback)
    const docs = await adapter.getAllStores();
    expect(docs).toHaveLength(0);
  });

  it("migrates an old-version backup instead of rejecting it", async () => {
    const rawBackup = createSyntheticFullBackup();

    // Downgrade the tasks document to a pre-v3 shape (no dailyFocus key at all,
    // legacy task fields) exactly like a backup from an older app version.
    const staleTasksDoc = {
      store: "lifeos-tasks" as StoreKey,
      version: 1,
      state: {
        tasks: [
          { id: "old-task", title: "Legacy Task", status: "todo", priority: "high", today: false },
        ],
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    rawBackup.stores = [rawBackup.stores[0], staleTasksDoc];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { checksum: _, ...payload } = rawBackup;
    const realChecksum = await calculateBackupChecksum(payload);
    const oldBackup: WaslBackup = { ...payload, checksum: realChecksum };

    const result = await importWaslBackupToLocal(oldBackup, adapter);
    expect(result.success).toBe(true);

    const tasksDoc = await adapter.getStore("lifeos-tasks");
    expect(tasksDoc?.version).toBe(getStoreVersion("lifeos-tasks"));
    expect(tasksDoc?.state.tasks[0].id).toBe("old-task");
  });

  it("imports and re-exports a backup containing trash items losslessly", async () => {
    // Regression: TrashItemSchema previously validated a fictional shape, so
    // ANY backup containing real trash items failed preview/import.
    const trashState = {
      items: [
        {
          id: "trash_1",
          itemType: "task" as const,
          title: "Deleted task",
          itemData: { id: "t9", title: "Deleted task", status: "todo", priority: "med", today: false, createdAt: "2026-08-01" },
          deletedAt: "2026-08-10T10:00:00.000Z",
          originalStoreKey: "lifeos-tasks",
        },
        {
          id: "trash_2",
          itemType: "workout" as const,
          title: "Old workout",
          description: "leg day",
          itemData: { id: "w9", date: "2026-08-09", sport: "Gym" },
          deletedAt: "2026-08-11T18:30:00.000Z",
          originalStoreKey: "lifeos-health",
        },
      ],
    };

    const rawBackup = createSyntheticFullBackup();
    rawBackup.stores.push({
      store: "lifeos-trash",
      version: getStoreVersion("lifeos-trash"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state: trashState as any,
      updatedAt: "2026-08-23T12:00:00.000Z",
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { checksum: _, ...payload } = rawBackup;
    const realChecksum = await calculateBackupChecksum(payload);
    const validBackup: WaslBackup = { ...payload, checksum: realChecksum };

    // Preview must be valid too (this is where the schema mismatch used to bite)
    const preview = await previewWaslBackup(validBackup);
    expect(preview.valid).toBe(true);
    expect(preview.errors).toHaveLength(0);

    const result = await importWaslBackupToLocal(validBackup, adapter);
    expect(result.success).toBe(true);
    expect(result.storesImported).toBe(3);

    const reExport = await exportWaslBackup(adapter);
    const trashDoc = reExport.backup.stores.find((s) => s.store === "lifeos-trash");
    expect(trashDoc).toBeDefined();
    expect(trashDoc?.state).toEqual(trashState);
  });
});

describe("Export Engine & Cloud Read-Only Verification", () => {
  it("exports all active stores into canonical WaslBackup with verified checksum", async () => {
    const dbName = `wasl-export-test-${Date.now()}`;
    const adapter = new LocalAdapter({ databaseName: dbName });
    await adapter.initialize();

    await adapter.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: { notes: [], categories: [] },
      updatedAt: new Date().toISOString(),
    });

    await adapter.putStore({
      store: "lifeos-habits",
      version: getStoreVersion("lifeos-habits"),
      state: { habits: [] },
      updatedAt: new Date().toISOString(),
    });

    const { backup, json } = await exportWaslBackup(adapter);
    expect(backup.stores).toHaveLength(2);
    expect(await verifyBackupChecksum(backup)).toBe(true);
    expect(typeof json).toBe("string");

    await adapter.close();
  });

  it("losslessly exports and previews realistic legacy health snapshots without stripping fields", async () => {
    const realisticLegacyHealthState = {
      days: {
        "2026-08-20": { steps: "12500", sleepH: "8", waterCups: 9, weightKg: "81.4", customNote: "Felt strong" },
      },
      workouts: [
        {
          id: "w-leg-day",
          date: "2026-08-20",
          sport: "Gym",
          minutes: "75",
          intensity: "vigorous",
          detailedExercises: [
            {
              exerciseId: "ex-squat",
              exerciseName: "Barbell Squat",
              trackingMode: "weight_reps",
              sets: [
                { type: "W", reps: "10", weightKg: "60", completed: true },
                { type: "N", reps: 8, weightKg: 100, rpe: 8, completed: true, isPR: true },
                { reps: 6, weightKg: 110, completed: true }, // LoggedSet without setNumber or id
              ],
              customTrainerNote: "Keep chest up on last rep",
            },
          ],
          customTag: "Heavy Day",
        },
      ],
      exercises: [
        { id: "ex-squat", name: "Barbell Squat", category: "Gym", equipment: "Barbell", primaryMuscle: "Quads" },
        { id: "ex-bag", name: "Heavy Bag Rounds", category: "Boxing/Martial Arts", equipment: "Ring/Bag", primaryMuscle: "Full Body" },
      ],
      programs: [
        {
          id: "prog-1",
          name: "Push Pull Legs",
          sport: "Gym",
          sessions: [
            {
              id: "sess-1",
              name: "Leg Day",
              dayName: "Thursday",
              sport: "Gym",
              exercises: [
                {
                  exerciseId: "ex-squat",
                  exerciseName: "Barbell Squat",
                  targetSets: [
                    { reps: 10, weightKg: 60, type: "W" },
                    { reps: 8, weightKg: 100, type: "N", restSec: 180 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      goals: { steps: "10000", waterCups: 8, sleepH: 8, sessionsPerWeek: 4 },
      activeWorkout: null,
    };

    
    const localAdapter = new LocalAdapter();
    // Populate mock doc directly
    const syntheticDoc: StoreDocument<"lifeos-health"> = {
      store: "lifeos-health",
      version: getStoreVersion("lifeos-health"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state: realisticLegacyHealthState as any,
      updatedAt: "2026-08-23T12:00:00.000Z",
    };
    await localAdapter.putStore(syntheticDoc);

    // 1. Lossless Export
    const { backup, json } = await exportWaslBackup(localAdapter);
    expect(backup.stores).toHaveLength(1);
    const exportedHealth = backup.stores[0].state as unknown as typeof realisticLegacyHealthState;

    // Verify lossless preservation of custom properties and unstripped fields
    expect((exportedHealth.days["2026-08-20"] as unknown as Record<string, unknown>).customNote).toBe("Felt strong");
    expect((exportedHealth.workouts[0] as unknown as Record<string, unknown>).customTag).toBe("Heavy Day");
    expect(exportedHealth.workouts[0].detailedExercises![0].sets[2].reps).toBe(6);

    // 2. Preview validation succeeds cleanly
    const preview = await previewWaslBackup(json);
    expect(preview.valid).toBe(true);
    expect(preview.errors).toHaveLength(0);
    expect(preview.stores[0].status).toBe("current");
    expect(preview.stores[0].entityCount).toBe(1); // 1 workout
  });

  it("fails export when an unrecognized store key is encountered", async () => {
    const mockAdapter = {
      edition: "local",
      getAllStores: () =>
        Promise.resolve([
          {
            store: "unknown-store-key" as unknown as StoreKey,
            version: 1,
            state: {},
            updatedAt: "2026-08-23T12:00:00.000Z",
          },
        ]),
    } as unknown as DataAdapter;

    await expect(exportWaslBackup(mockAdapter)).rejects.toThrow(
      'Cannot export unrecognized store: "unknown-store-key".',
    );
  });

  it("fails export when a store state is not JSON-serializable", async () => {
    const circularState: Record<string, unknown> = {};
    circularState.self = circularState;

    const mockAdapter = {
      edition: "local",
      getAllStores: () =>
        Promise.resolve([
          {
            store: "lifeos-tasks" as StoreKey,
            version: getStoreVersion("lifeos-tasks"),
            state: circularState,
            updatedAt: "2026-08-23T12:00:00.000Z",
          },
        ]),
    } as unknown as DataAdapter;

    await expect(exportWaslBackup(mockAdapter)).rejects.toThrow(
      'Export failed: Store "lifeos-tasks" state is not JSON-serializable:',
    );
  });
});

describe("Legacy LocalStorage Converter", () => {
  it("parses scoped, unscoped, and legacy storage keys", () => {
    expect(parseLegacyStorageKey("lifeos-notes")).toEqual({ storeName: "lifeos-notes" });
    expect(parseLegacyStorageKey("lifeos-user123-tasks")).toEqual({
      storeName: "lifeos-tasks",
      scope: "user123",
    });
    expect(parseLegacyStorageKey("unrelated-key")).toBeNull();
  });

  it("detects legacy data and user scope conflicts", () => {
    const storageWithConflict: Record<string, string> = {
      "lifeos-userA-notes": JSON.stringify({ state: { notes: [], categories: [] }, version: 3 }),
      "lifeos-userB-notes": JSON.stringify({ state: { notes: [], categories: [] }, version: 3 }),
      "lifeos-projects": JSON.stringify({ state: { projects: [] }, version: 1 }),
    };

    const detected = detectLegacyLocalStorage(storageWithConflict);
    expect(detected.hasLegacyData).toBe(true);
    expect(detected.hasConflict).toBe(true);
    expect(detected.detectedScopes).toContain("userA");
    expect(detected.detectedScopes).toContain("userB");
    expect(detected.archivedStores).toHaveLength(1);
    expect(detected.archivedStores[0].storeName).toBe("lifeos-projects");
  });

  it("converts legacy storage and places archived stores into legacyArchives", async () => {
    const legacyStorage: Record<string, string> = {
      "lifeos-notes": JSON.stringify({ state: { notes: [], categories: [] }, version: 3 }),
      "lifeos-projects": JSON.stringify({ state: { projects: [{ id: "p1", name: "Archived Project" }] }, version: 1 }),
      "lifeos-reviews": JSON.stringify({ state: { reviews: [] }, version: 4 }),
    };

    const { backup, legacyArchives } = await convertLegacyStorageToBackup(legacyStorage);

    expect(backup.stores).toHaveLength(1);
    expect(backup.stores[0].store).toBe("lifeos-notes");
    expect(legacyArchives).toHaveLength(2);
    expect(legacyArchives.map((a) => (a.payload as { store: string }).store)).toContain("lifeos-projects");
    expect(legacyArchives.map((a) => (a.payload as { store: string }).store)).toContain("lifeos-reviews");
  });
});

describe("health program sets-shape compatibility (regression: cloud→local import)", () => {
  it("imports backups containing MCP-authored programs with scalar sets counts", async () => {
    const dbName = `wasl-sets-test-${Date.now()}`;
    const adapter = new LocalAdapter({ databaseName: dbName });

    const programState = {
      days: {},
      workouts: [],
      programs: [
        {
          id: "p1",
          name: "AI-built push day",
          description: "",
          sessions: [
            {
              id: "s1",
              name: "Push day",
              dayName: "Day 1",
              exercises: [
                {
                  exerciseId: "ex-bench",
                  exerciseName: "Barbell Bench Press",
                  targetSets: [
                    { type: "N", reps: 8, weightKg: 70, rpe: 8 },
                    { type: "N", reps: 8, weightKg: 70, rpe: 8 },
                    { type: "N", reps: 8, weightKg: 70, rpe: 8 },
                  ],
                  sets: 3,
                },
              ],
            },
          ],
        },
      ],
    };

    const rawBackup = createSyntheticFullBackup();
    rawBackup.stores.push({
      store: "lifeos-health",
      version: getStoreVersion("lifeos-health"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state: programState as any,
      updatedAt: "2026-08-25T12:00:00.000Z",
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { checksum: _, ...payload } = rawBackup;
    const realChecksum = await calculateBackupChecksum(payload);
    const backup: WaslBackup = { ...payload, checksum: realChecksum };

    const preview = await previewWaslBackup(backup);
    expect(preview.valid).toBe(true);
    expect(preview.errors).toHaveLength(0);

    const result = await importWaslBackupToLocal(backup, adapter);
    expect(result.success).toBe(true);

    const health = await adapter.getStore("lifeos-health");
    const program = health?.state.programs[0] as unknown as {
      sessions: Array<{ exercises: Array<{ sets?: unknown; targetSets: unknown[] }> }>;
    };
    expect(program.sessions[0].exercises[0].sets).toBe(3);
    expect(program.sessions[0].exercises[0].targetSets).toHaveLength(3);
    await adapter.close();
  });
});
