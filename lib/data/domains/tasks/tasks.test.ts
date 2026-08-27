// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";

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
import { useTasksData } from "./hooks";
import {
  createDefaultTasksState,
  normalizeTask,
  addTaskOperation,
  updateTaskOperation,
  toggleTaskOperation,
  deleteTaskOperation,
  initializeDailyFocusOperation,
  setDailyFocusTaskOperation,
  type Task,
} from "./operations";
import type { TasksPersistedState } from "../../types";
import { migrateTasksSnapshot, CURRENT_TASKS_VERSION } from "./migrations";

describe("Tasks Domain — Pure Operations & Normalization", () => {
  it("normalizes malformed raw input to clean task object", () => {
    const raw = {
      done: true,
      priority: "high",
      date: "2026-08-23",
      title: "  Refactor domain store  ",
    };
    const task = normalizeTask(raw);
    expect(task.status).toBe("done");
    expect(task.priority).toBe("high");
    expect(task.due).toBe("2026-08-23");
    expect(task.title).toBe("Refactor domain store");
    expect(task.id).toBeDefined();
  });

  it("creates default state with rich starter tasks and daily focus", () => {
    const defaultState = createDefaultTasksState();
    expect(defaultState.tasks.length).toBeGreaterThan(0);
    expect(Object.keys(defaultState.dailyFocus).length).toBeGreaterThan(0);
  });

  it("adds, updates, toggles, and deletes tasks cleanly", () => {
    const initial: TasksPersistedState = { tasks: [], dailyFocus: {} };
    const task: Task = {
      id: "task-1",
      title: "Complete Phase 5 Batch D",
      status: "todo",
      priority: "high",
      today: true,
      createdAt: "2026-08-23",
    };

    const added = addTaskOperation(initial, task);
    expect(added.tasks.length).toBe(1);

    const toggled = toggleTaskOperation(added, "task-1");
    expect(toggled.tasks[0].status).toBe("done");
    expect(toggled.tasks[0].completedAt).toBeDefined();

    const updated = updateTaskOperation(toggled, "task-1", { priority: "med" });
    expect(updated.tasks[0].priority).toBe("med");

    const deleted = deleteTaskOperation(updated, "task-1");
    expect(deleted.tasks.length).toBe(0);
  });

  it("initializes and slots daily focus correctly", () => {
    let state: TasksPersistedState = { tasks: [], dailyFocus: {} };
    const t1: Task = { id: "t-1", title: "Task 1", status: "todo", priority: "high", today: true, createdAt: "2026-08-23" };
    const t2: Task = { id: "t-2", title: "Task 2", status: "todo", priority: "med", today: true, createdAt: "2026-08-23" };
    state = addTaskOperation(state, t1);
    state = addTaskOperation(state, t2);

    state = initializeDailyFocusOperation(state, "2026-08-23");
    expect(state.dailyFocus["2026-08-23"]).toBeDefined();
    expect(state.dailyFocus["2026-08-23"].length).toBe(2);

    // Slot specific task
    state = setDailyFocusTaskOperation(state, "2026-08-23", 0, "t-2");
    expect(state.dailyFocus["2026-08-23"][0]).toBe("t-2");

    // Deleting task removes from dailyFocus
    state = deleteTaskOperation(state, "t-2");
    expect(state.dailyFocus["2026-08-23"].includes("t-2")).toBe(false);
  });
});

describe("Tasks Domain — Migrations", () => {
  it("migrates older version snapshots (< v3) cleanly", () => {
    const oldSnapshot = {
      tasks: [{ id: "t-legacy", title: "Legacy Task", done: true }],
      dailyFocus: { "2026-08-23": ["t-legacy"] },
    };
    const migrated = migrateTasksSnapshot(oldSnapshot, 2);
    expect(migrated.tasks.length).toBe(1);
    expect(migrated.tasks[0].status).toBe("done");
    expect(migrated.dailyFocus["2026-08-23"]).toEqual(["t-legacy"]);
  });

  it("throws error for unsupported future version", () => {
    expect(() => migrateTasksSnapshot({ tasks: [] }, CURRENT_TASKS_VERSION + 1)).toThrow();
  });
});

describe("Tasks Domain — Adapter Integration & Trash Bridge", () => {
  let localAdapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(async () => {
    testLocalStorage.clear();
    localAdapter = new LocalAdapter({ databaseName: `test-tasks-db-${Date.now()}` });
    await localAdapter.initialize();
    await localAdapter.putStore({
      store: "lifeos-tasks",
      version: 3,
      state: { tasks: [], dailyFocus: {} },
      updatedAt: new Date().toISOString(),
      revision: 1,
    });
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

  it("reads, adds, updates tasks and bridges delete to Trash", async () => {
    const { result } = renderHook(() => useTasksData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdTask!: Task;
    await act(async () => {
      createdTask = await result.current.addTask({
        title: "Test Adapter Task",
        priority: "high",
        today: true,
      });
    });

    expect(createdTask.id).toBeDefined();
    await waitFor(() => expect(result.current.tasks.length).toBe(1));

    // Toggle
    await act(async () => {
      await result.current.toggleTask(createdTask.id);
    });
    await waitFor(() => expect(result.current.tasks[0].status).toBe("done"));

    // Delete -> bridges to Trash
    await act(async () => {
      await result.current.deleteTask(createdTask.id);
    });
    await waitFor(() => expect(result.current.tasks.length).toBe(0));

    const trashDoc = await localAdapter.getStore("lifeos-trash");
    const trashItems = (trashDoc?.state?.items as Array<{ originalStoreKey: string; title: string }>) || [];
    const trashed = trashItems.find((i) => i.originalStoreKey === "lifeos-tasks");
    expect(trashed).toBeDefined();
    expect(trashed?.title).toBe("Test Adapter Task");
  });

  it("aborts deletion and preserves task if Trash throws error", async () => {
    const { result } = renderHook(() => useTasksData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdTask!: Task;
    await act(async () => {
      createdTask = await result.current.addTask({
        title: "Preserved Task",
        priority: "med",
        today: true,
      });
    });

    await waitFor(() => expect(result.current.tasks.length).toBe(1));

    const originalMutate = localAdapter.mutateStore.bind(localAdapter);
    vi.spyOn(localAdapter, "mutateStore").mockImplementation(async (key: any, updater: any) => {
      if (key === "lifeos-trash") {
        throw new Error("Trash database failure");
      }
      return (originalMutate as any)(key, updater);
    });

    await expect(
      act(async () => {
        await result.current.deleteTask(createdTask.id);
      }),
    ).rejects.toThrow("Trash database failure");

    expect(result.current.tasks.length).toBe(1);
    expect(result.current.tasks[0].id).toBe(createdTask.id);

    const doc = await localAdapter.getStore("lifeos-tasks");
    expect(doc?.state.tasks.some((t: Task) => t.id === createdTask.id)).toBe(true);
  });
});
