// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import "fake-indexeddb/auto";
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { testLocalStorage } = vi.hoisted(() => {
  const storageValues = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return storageValues.size;
    },
    clear: () => storageValues.clear(),
    getItem: (key) => storageValues.get(key) ?? null,
    key: (index) => [...storageValues.keys()][index] ?? null,
    removeItem: (key) => {
      storageValues.delete(key);
    },
    setItem: (key, value) => {
      storageValues.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return { testLocalStorage: storage };
});

import { LocalAdapter } from "../../adapters/local/local-adapter";
import { DataProvider, createMemoryQueryClient } from "../../query/provider";
import {
  createDefaultTrashState,
  normalizeTrashItem,
  moveToTrashOperation,
  deletePermanentlyOperation,
  emptyTrashOperation,
  CURRENT_TRASH_VERSION,
  migrateTrashSnapshot,
  deleteEntityWithTrash,
  restoreEntityFromTrash,
  restoreDefaultProgramsService,
  TrashConflictError,
  useTrashData,
  type TrashItem,
} from "./index";
import type { Task } from "../tasks";
import type { Note } from "../notes";
import type { Goal } from "../goals";
import type { Habit } from "../habits";
import type { Workout, WorkoutProgram } from "../health";

describe("Trash Domain — Pure Operations", () => {
  it("creates default trash state", () => {
    const state = createDefaultTrashState();
    expect(state).toEqual({ items: [] });
  });

  it("normalizes valid trash items and discards malformed ones", () => {
    const validRaw = {
      id: "trash-note-1",
      itemType: "note",
      title: "My Note",
      description: "Note preview",
      itemData: { id: "n1", title: "My Note", body: "Note preview" },
      deletedAt: "2026-08-23T12:00:00Z",
      originalStoreKey: "lifeos-notes",
    };
    const item = normalizeTrashItem(validRaw);
    expect(item).not.toBeNull();
    expect(item?.id).toBe("trash-note-1");
    expect(item?.itemType).toBe("note");
    expect(item?.title).toBe("My Note");

    // Invalid itemType
    expect(normalizeTrashItem({ id: "t1", itemType: "invalid", title: "X", itemData: {} })).toBeNull();
    // Missing id
    expect(normalizeTrashItem({ itemType: "note", title: "X", itemData: {} })).toBeNull();
    // Missing itemData
    expect(normalizeTrashItem({ id: "t1", itemType: "note", title: "X" })).toBeNull();
  });

  it("adds, removes, deletes permanently and empties trash idempotently", () => {
    let state = createDefaultTrashState();
    const item1: TrashItem = {
      id: "trash-task-1",
      itemType: "task",
      title: "Task 1",
      itemData: { id: "task-1", title: "Task 1" },
      deletedAt: "2026-08-23T12:00:00Z",
      originalStoreKey: "lifeos-tasks",
    };
    const item2: TrashItem = {
      id: "trash-goal-1",
      itemType: "goal",
      title: "Goal 1",
      itemData: { id: "goal-1", title: "Goal 1" },
      deletedAt: "2026-08-23T12:00:00Z",
      originalStoreKey: "lifeos-goals",
    };

    // Add item 1
    state = moveToTrashOperation(state, item1);
    expect(state.items.length).toBe(1);

    // Add item 1 again (idempotent overwrite)
    state = moveToTrashOperation(state, item1);
    expect(state.items.length).toBe(1);

    // Add item 2
    state = moveToTrashOperation(state, item2);
    expect(state.items.length).toBe(2);

    // Delete item 1 permanently
    state = deletePermanentlyOperation(state, "trash-task-1");
    expect(state.items.length).toBe(1);
    expect(state.items[0].id).toBe("trash-goal-1");

    // Empty trash
    state = emptyTrashOperation();
    expect(state.items.length).toBe(0);
  });
});

describe("Trash Domain — Migrations", () => {
  it("migrates v1 snapshot cleanly", () => {
    const raw = {
      items: [
        {
          id: "trash-note-1",
          itemType: "note",
          title: "Note title",
          itemData: { id: "n-1" },
        },
      ],
    };
    const migrated = migrateTrashSnapshot(raw, 1);
    expect(migrated.items.length).toBe(1);
    expect(migrated.items[0].title).toBe("Note title");
  });

  it("throws for future unsupported version", () => {
    expect(() => migrateTrashSnapshot({}, CURRENT_TRASH_VERSION + 1)).toThrow(
      /Cannot migrate Trash snapshot from future version/,
    );
  });
});

describe("Trash Domain — Cross-Domain Orchestration Service", () => {
  let localAdapter: LocalAdapter;

  beforeEach(async () => {
    testLocalStorage.clear();
    localAdapter = new LocalAdapter({ databaseName: `test-trash-db-${Date.now()}` });
    await localAdapter.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("safely moves all 6 supported entity types to Trash", async () => {
    // 1. Task
    const task: Task = { id: "task-1", title: "Complete report", status: "todo", priority: "med", today: true, createdAt: "2026-08-23" };
    await localAdapter.mutateStore("lifeos-tasks", () => ({ tasks: [task], dailyFocus: {} }));
    await deleteEntityWithTrash(localAdapter, {
      itemType: "task",
      entity: task,
      originalStoreKey: "lifeos-tasks",
      deleteFromSource: async (adapter) => {
        await adapter.mutateStore("lifeos-tasks", () => ({ tasks: [], dailyFocus: {} }));
      },
    });

    // 2. Note
    const note: Note = { id: "note-1", title: "Meeting Notes", body: "Action items", pinned: false, tag: "Work", updatedAt: 1 };
    await localAdapter.mutateStore("lifeos-notes", () => ({ notes: [note], categories: [] }));
    await deleteEntityWithTrash(localAdapter, {
      itemType: "note",
      entity: note,
      originalStoreKey: "lifeos-notes",
      deleteFromSource: async (adapter) => {
        await adapter.mutateStore("lifeos-notes", () => ({ notes: [], categories: [] }));
      },
    });

    // 3. Goal
    const goal: Goal = { id: "goal-1", title: "Launch App", why: "", plan: "", milestones: [], manualProgress: 0, completed: false, category: "business_finance", type: "yearly_outcome", status: "active", isCurrentFocus: false };
    await localAdapter.mutateStore("lifeos-goals", () => ({ goals: [goal] }));
    await deleteEntityWithTrash(localAdapter, {
      itemType: "goal",
      entity: goal,
      originalStoreKey: "lifeos-goals",
      deleteFromSource: async (adapter) => {
        await adapter.mutateStore("lifeos-goals", () => ({ goals: [] }));
      },
    });

    // 4. Habit
    const habit: Habit = { id: "habit-1", name: "Morning run", icon: "sparkles" as any, color: "#10b981", targetPerWeek: 7, log: {}, createdAt: "2026-08-23" };
    await localAdapter.mutateStore("lifeos-habits", () => ({ habits: [habit] }));
    await deleteEntityWithTrash(localAdapter, {
      itemType: "habit",
      entity: habit,
      originalStoreKey: "lifeos-habits",
      deleteFromSource: async (adapter) => {
        await adapter.mutateStore("lifeos-habits", () => ({ habits: [] }));
      },
    });

    // 5. Workout Program
    const prog: WorkoutProgram = { id: "prog-1", name: "Hypertrophy A", sport: "Gym", sessions: [], description: "Heavy lifting" };
    await localAdapter.mutateStore("lifeos-health", () => ({ programs: [prog], workouts: [], days: {}, exercises: [], customSports: [], activeWorkout: null }));
    await deleteEntityWithTrash(localAdapter, {
      itemType: "program",
      entity: prog,
      originalStoreKey: "lifeos-health",
      deleteFromSource: async (adapter) => {
        await adapter.mutateStore("lifeos-health", () => ({ programs: [], workouts: [], days: {}, exercises: [], customSports: [], activeWorkout: null }));
      },
    });

    // 6. Workout
    const workout: Workout = { id: "w-1", sport: "Gym", date: "2026-08-23", minutes: 45, intensity: "vigorous", note: "Leg Day" };
    await localAdapter.mutateStore("lifeos-health", () => ({ programs: [], workouts: [workout], days: {}, exercises: [], customSports: [], activeWorkout: null }));
    await deleteEntityWithTrash(localAdapter, {
      itemType: "workout",
      entity: workout,
      originalStoreKey: "lifeos-health",
      deleteFromSource: async (adapter) => {
        await adapter.mutateStore("lifeos-health", () => ({ programs: [], workouts: [], days: {}, exercises: [], customSports: [], activeWorkout: null }));
      },
    });

    // Verify all 6 are in lifeos-trash
    const trashDoc = await localAdapter.getStore("lifeos-trash");
    const items = trashDoc?.state.items as TrashItem[];
    expect(items.length).toBe(6);
    expect(items.map((i) => i.itemType).sort()).toEqual(["goal", "habit", "note", "program", "task", "workout"].sort());
  });

  it("aborts deletion and preserves source entity if Trash write fails", async () => {
    const task: Task = { id: "task-safe-1", title: "Safe Task", status: "todo", priority: "med", today: true, createdAt: "2026-08-23" };
    await localAdapter.mutateStore("lifeos-tasks", () => ({ tasks: [task], dailyFocus: {} }));

    let sourceDeleted = false;

    // Simulate Trash store failure
    const originalMutate = localAdapter.mutateStore.bind(localAdapter);
    vi.spyOn(localAdapter, "mutateStore").mockImplementation(async (key: any, updater: any) => {
      if (key === "lifeos-trash") {
        throw new Error("Simulated storage write error in lifeos-trash");
      }
      return originalMutate(key, updater);
    });

    await expect(
      deleteEntityWithTrash(localAdapter, {
        itemType: "task",
        entity: task,
        originalStoreKey: "lifeos-tasks",
        deleteFromSource: async () => {
          sourceDeleted = true;
        },
      }),
    ).rejects.toThrow("Simulated storage write error in lifeos-trash");

    // Source deletion callback was never reached
    expect(sourceDeleted).toBe(false);

    // Source store remains intact
    const taskDoc = await localAdapter.getStore("lifeos-tasks");
    expect(taskDoc?.state.tasks.some((t: Task) => t.id === "task-safe-1")).toBe(true);
  });

  it("preserves duplicate in Trash if source deletion fails after Trash succeeds", async () => {
    const task: Task = { id: "task-dup-1", title: "Duplicate Task", status: "todo", priority: "med", today: true, createdAt: "2026-08-23" };
    await localAdapter.mutateStore("lifeos-tasks", () => ({ tasks: [task], dailyFocus: {} }));

    await expect(
      deleteEntityWithTrash(localAdapter, {
        itemType: "task",
        entity: task,
        originalStoreKey: "lifeos-tasks",
        deleteFromSource: async () => {
          throw new Error("Source deletion failed due to network/disk error");
        },
      }),
    ).rejects.toThrow("Source deletion failed due to network/disk error");

    // Both copies are preserved (recoverable duplicate)
    const trashDoc = await localAdapter.getStore("lifeos-trash");
    expect(trashDoc?.state.items.some((i: TrashItem) => i.id === "trash-task-task-dup-1")).toBe(true);

    const taskDoc = await localAdapter.getStore("lifeos-tasks");
    expect(taskDoc?.state.tasks.some((t: Task) => t.id === "task-dup-1")).toBe(true);
  });

  it("safely restores each entity type to its destination store", async () => {
    // Populate Trash with a task and a note
    const task: Task = { id: "t-restore-1", title: "Restored Task", status: "todo", priority: "med", today: true, createdAt: "2026-08-23" };
    const note: Note = { id: "n-restore-1", title: "Restored Note", body: "Body", pinned: false, tag: "General", updatedAt: 1 };

    await localAdapter.mutateStore("lifeos-trash", () => ({
      items: [
        {
          id: "trash-task-t-restore-1",
          itemType: "task",
          title: "Restored Task",
          itemData: task,
          deletedAt: "2026-08-23T12:00:00Z",
          originalStoreKey: "lifeos-tasks",
        },
        {
          id: "trash-note-n-restore-1",
          itemType: "note",
          title: "Restored Note",
          itemData: note,
          deletedAt: "2026-08-23T12:00:00Z",
          originalStoreKey: "lifeos-notes",
        },
      ],
    }));

    // Restore Task
    await restoreEntityFromTrash(localAdapter, "trash-task-t-restore-1");
    const taskDoc = await localAdapter.getStore("lifeos-tasks");
    expect(taskDoc?.state.tasks.some((t: Task) => t.id === "t-restore-1")).toBe(true);

    // Restore Note
    await restoreEntityFromTrash(localAdapter, "trash-note-n-restore-1");
    const noteDoc = await localAdapter.getStore("lifeos-notes");
    expect(noteDoc?.state.notes.some((n: Note) => n.id === "n-restore-1")).toBe(true);

    // Verify both items were removed from Trash
    const trashDoc = await localAdapter.getStore("lifeos-trash");
    expect(trashDoc?.state.items.length).toBe(0);
  });

  it("preserves Trash item and aborts restoration if conflicting ID already exists in destination", async () => {
    const existingTask: Task = { id: "t-conflict-1", title: "Existing Active Task", status: "todo", priority: "med", today: true, createdAt: "2026-08-23" };
    await localAdapter.mutateStore("lifeos-tasks", () => ({ tasks: [existingTask], dailyFocus: {} }));

    const trashedTask: Task = { id: "t-conflict-1", title: "Conflicting Trashed Task", status: "todo", priority: "med", today: true, createdAt: "2026-08-23" };
    await localAdapter.mutateStore("lifeos-trash", () => ({
      items: [
        {
          id: "trash-task-t-conflict-1",
          itemType: "task",
          title: "Conflicting Trashed Task",
          itemData: trashedTask,
          deletedAt: "2026-08-23T12:00:00Z",
          originalStoreKey: "lifeos-tasks",
        },
      ],
    }));

    // Attempting restore throws TrashConflictError
    await expect(
      restoreEntityFromTrash(localAdapter, "trash-task-t-conflict-1"),
    ).rejects.toThrow(TrashConflictError);

    // Trash item is preserved
    const trashDoc = await localAdapter.getStore("lifeos-trash");
    expect(trashDoc?.state.items.length).toBe(1);

    // Existing active task in destination is NOT overwritten
    const taskDoc = await localAdapter.getStore("lifeos-tasks");
    expect(taskDoc?.state.tasks[0].title).toBe("Existing Active Task");
  });

  it("preserves both copies if Trash removal fails after destination restore succeeds", async () => {
    const task: Task = { id: "t-safe-restore", title: "Safe Restore Task", status: "todo", priority: "med", today: true, createdAt: "2026-08-23" };
    await localAdapter.mutateStore("lifeos-trash", () => ({
      items: [
        {
          id: "trash-task-safe-restore",
          itemType: "task",
          title: "Safe Restore Task",
          itemData: task,
          deletedAt: "2026-08-23T12:00:00Z",
          originalStoreKey: "lifeos-tasks",
        },
      ],
    }));

    // Spy on lifeos-trash mutation to fail during step 2 (removing from trash)
    let callCount = 0;
    const originalMutate = localAdapter.mutateStore.bind(localAdapter);
    vi.spyOn(localAdapter, "mutateStore").mockImplementation(async (key: any, updater: any) => {
      if (key === "lifeos-trash") {
        callCount++;
        if (callCount > 0) {
          throw new Error("Trash removal failed after restore");
        }
      }
      return originalMutate(key, updater);
    });

    await expect(
      restoreEntityFromTrash(localAdapter, "trash-task-safe-restore"),
    ).rejects.toThrow("Trash removal failed after restore");

    // Destination entity is present
    const taskDoc = await localAdapter.getStore("lifeos-tasks");
    expect(taskDoc?.state.tasks.some((t: Task) => t.id === "t-safe-restore")).toBe(true);

    // Trash item is still preserved (safe recoverable duplicate)
    const trashDoc = await localAdapter.getStore("lifeos-trash");
    expect(trashDoc?.state.items.some((i: TrashItem) => i.id === "trash-task-safe-restore")).toBe(true);
  });

  it("restores default training programs safely", async () => {
    await restoreDefaultProgramsService(localAdapter);
    const healthDoc = await localAdapter.getStore("lifeos-health");
    expect(healthDoc?.state.programs.length).toBeGreaterThan(0);
  });
});

describe("Trash Domain — useTrashData Hook & UI Integration", () => {
  let localAdapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(async () => {
    testLocalStorage.clear();
    localAdapter = new LocalAdapter({ databaseName: `test-trash-hook-${Date.now()}` });
    await localAdapter.initialize();
    queryClient = createMemoryQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      DataProvider,
      { adapter: localAdapter, queryClient, edition: "local" },
      children,
    );
  }

  it("reads, adds, deletes permanently and empties trash via useTrashData", async () => {
    const { result } = renderHook(() => useTrashData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.length).toBe(0);

    // Move item to trash
    await act(async () => {
      await result.current.moveToTrash({
        itemType: "task",
        title: "Hook Task",
        itemData: { id: "ht-1", title: "Hook Task" },
        originalStoreKey: "lifeos-tasks",
      });
    });

    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(result.current.items[0].title).toBe("Hook Task");

    // Add another item
    let item2!: TrashItem;
    await act(async () => {
      item2 = await result.current.moveToTrash({
        itemType: "note",
        title: "Hook Note",
        itemData: { id: "hn-1", title: "Hook Note" },
        originalStoreKey: "lifeos-notes",
      });
    });

    await waitFor(() => expect(result.current.items.length).toBe(2));

    // Delete item 2 permanently
    await act(async () => {
      await result.current.deletePermanently(item2.id);
    });

    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(result.current.items[0].title).toBe("Hook Task");

    // Empty trash
    await act(async () => {
      await result.current.emptyTrash();
    });

    await waitFor(() => expect(result.current.items.length).toBe(0));
  });
});
