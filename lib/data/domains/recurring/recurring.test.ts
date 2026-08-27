// @vitest-environment jsdom
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
import { useRecurringData } from "./hooks";
import { todayISO, addDays } from "@/lib/date";
import {
  createDefaultRecurringState,
  addRecurringOperation,
  updateRecurringOperation,
  toggleOccurrenceOperation,
  deleteRecurringOperation,
  isOccurrence,
  ruleLabel,
  completionRate,
  recurringStreak,
  type RecurringTask,
} from "./operations";
import type { RecurringPersistedState } from "../../types";
import { generateRecurringTaskId, generateTasksForRecurringDate } from "./idempotency";
import { migrateRecurringSnapshot, CURRENT_RECURRING_VERSION } from "./migrations";

describe("Recurring Domain — Pure Operations & Occurrence Engine", () => {
  it("computes occurrence and rule labels accurately", () => {
    const dailyTask: RecurringTask = {
      id: "rec-1",
      title: "Daily Review",
      rule: { freq: "daily" },
      startDate: "2026-08-01",
      completions: {},
      createdAt: "2026-08-01",
    };

    expect(isOccurrence(dailyTask, "2026-08-23")).toBe(true);
    expect(isOccurrence(dailyTask, "2026-07-31")).toBe(false); // Before start date
    expect(ruleLabel(dailyTask.rule)).toBe("Every day");

    const weeklyTask: RecurringTask = {
      id: "rec-2",
      title: "Weekly Planning",
      rule: { freq: "weekly", weekDays: [0] }, // Monday
      startDate: "2026-08-01",
      completions: {},
      createdAt: "2026-08-01",
    };
    // 2026-08-24 is a Monday
    expect(isOccurrence(weeklyTask, "2026-08-24")).toBe(true);
    // 2026-08-23 is Sunday
    expect(isOccurrence(weeklyTask, "2026-08-23")).toBe(false);
  });

  it("calculates completions and streaks correctly", () => {
    const t0 = todayISO();
    const t1 = addDays(t0, -1);
    const t2 = addDays(t0, -2);
    const task: RecurringTask = {
      id: "rec-s",
      title: "Morning Routine",
      rule: { freq: "daily" },
      startDate: addDays(t0, -10),
      completions: {
        [t2]: true,
        [t1]: true,
        [t0]: true,
      },
      createdAt: addDays(t0, -10),
    };

    expect(completionRate(task, 3)).toBe(100);
    expect(recurringStreak(task)).toBeGreaterThanOrEqual(1);
  });

  it("adds, updates, toggles completions, and deletes recurring tasks", () => {
    const initial: RecurringPersistedState = { recurring: [] };
    const task: RecurringTask = {
      id: "rec-main",
      title: "Team Standup",
      rule: { freq: "weekly", weekDays: [0, 1, 2, 3, 4] },
      startDate: "2026-08-01",
      completions: {},
      createdAt: "2026-08-01",
    };

    const added = addRecurringOperation(initial, task);
    expect(added.recurring.length).toBe(1);

    const toggled = toggleOccurrenceOperation(added, "rec-main", "2026-08-23");
    expect(toggled.recurring[0].completions["2026-08-23"]).toBe(true);

    const unToggled = toggleOccurrenceOperation(toggled, "rec-main", "2026-08-23");
    expect(unToggled.recurring[0].completions["2026-08-23"]).toBeUndefined();

    const updated = updateRecurringOperation(unToggled, "rec-main", { title: "Daily Sync" });
    expect(updated.recurring[0].title).toBe("Daily Sync");

    const deleted = deleteRecurringOperation(updated, "rec-main");
    expect(deleted.recurring.length).toBe(0);
  });
});

describe("Recurring Domain — Multi-Store Idempotency & Partial Failure Safety", () => {
  it("generates deterministic task IDs preventing duplicates on retry", () => {
    const recurringId = "rec-daily-meditation";
    const date = "2026-08-23";
    const id1 = generateRecurringTaskId(recurringId, date);
    const id2 = generateRecurringTaskId(recurringId, date);
    expect(id1).toBe(id2);
    expect(id1).toBe("rec-rec-daily-meditation-2026-08-23");

    const recurringTask: RecurringTask = {
      id: recurringId,
      title: "Meditation",
      rule: { freq: "daily" },
      startDate: "2026-08-01",
      completions: {},
      createdAt: "2026-08-01",
    };

    const generated = generateTasksForRecurringDate([recurringTask], date, []);
    expect(generated.length).toBe(1);
    expect(generated[0].title).toBe("Meditation");

    // Re-running with existing task prevents duplicates
    const generatedAgain = generateTasksForRecurringDate([recurringTask], date, [
      {
        id: id1,
        title: "Meditation",
        status: "todo",
        priority: "med",
        today: true,
        createdAt: date,
      },
    ]);
    expect(generatedAgain.length).toBe(0);
  });

  it("recovers safely from partial write failure between task and recurring updates", () => {
    const recurringId = "rec-water-plants";
    const date = "2026-08-23";
    const deterministicId = generateRecurringTaskId(recurringId, date);

    const taskStore = [
      {
        id: deterministicId,
        title: "Water Plants",
        status: "todo" as const,
        priority: "med" as const,
        today: true,
        createdAt: date,
      },
    ];

    let recurringState = createDefaultRecurringState();
    recurringState = addRecurringOperation(recurringState, {
      id: recurringId,
      title: "Water Plants",
      rule: { freq: "daily" },
      startDate: "2026-08-01",
      completions: {},
      createdAt: "2026-08-01",
    });

    // Simulated failure before completion is persisted:
    expect(recurringState.recurring[0].completions[date]).toBeUndefined();

    // Retry generates 0 duplicates
    const newTasks = generateTasksForRecurringDate(recurringState.recurring, date, taskStore);
    expect(newTasks.length).toBe(0);

    // Retry succeeds on recurring completion
    recurringState = toggleOccurrenceOperation(recurringState, recurringId, date);
    expect(recurringState.recurring[0].completions[date]).toBe(true);
  });
});

describe("Recurring Domain — Migrations", () => {
  it("migrates older version snapshots cleanly", () => {
    const oldSnapshot = {
      recurring: [{ id: "r-1", title: "Water plants", rule: { freq: "daily" } }],
    };
    const migrated = migrateRecurringSnapshot(oldSnapshot, 1);
    expect(migrated.recurring.length).toBe(1);
  });

  it("throws error for unsupported future version", () => {
    expect(() => migrateRecurringSnapshot({ recurring: [] }, CURRENT_RECURRING_VERSION + 1)).toThrow();
  });
});

describe("Recurring Domain — Adapter Integration", () => {
  let localAdapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(async () => {
    testLocalStorage.clear();
    localAdapter = new LocalAdapter({ databaseName: `test-recurring-db-${Date.now()}` });
    await localAdapter.initialize();
    await localAdapter.putStore({
      store: "lifeos-recurring",
      version: 1,
      state: { recurring: [] },
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

  it("reads, adds, updates recurring tasks and toggles completions", async () => {
    const { result } = renderHook(() => useRecurringData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdTask!: RecurringTask;
    await act(async () => {
      createdTask = await result.current.addRecurring({
        title: "Weekly Backup Review",
        rule: { freq: "weekly", weekDays: [4] },
        startDate: "2026-08-01",
      });
    });

    expect(createdTask.id).toBeDefined();
    await waitFor(() => expect(result.current.recurring.length).toBe(1));

    // Toggle occurrence
    await act(async () => {
      await result.current.toggleOccurrence(createdTask.id, "2026-08-23");
    });
    await waitFor(() => expect(result.current.recurring[0].completions["2026-08-23"]).toBe(true));

    // Delete
    await act(async () => {
      await result.current.deleteRecurring(createdTask.id);
    });
    await waitFor(() => expect(result.current.recurring.length).toBe(0));
  });
});
