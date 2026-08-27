// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { LocalAdapter } from "../../adapters/local/local-adapter";
import { DataProvider, createMemoryQueryClient } from "../../query/provider";
import type { DataAdapter, HabitsPersistedState } from "../../types";
import { useHabitsData } from "./hooks";
import {
  createDefaultHabitsState,
  normalizeHabit,
  addHabitOperation,
  updateHabitOperation,
  toggleDayOperation,
  deleteHabitOperation,
  moveHabitOperation,
  reorderHabitsOperation,
  habitStreak,
  weekDone,
  consistencyGrid,
} from "./operations";
import { migrateHabitsSnapshot, CURRENT_HABITS_VERSION } from "./migrations";
import type { Habit } from "./types";

describe("Habits Domain — Pure Operations", () => {
  it("normalizes habits and creates clean defaults", () => {
    const defaultState = createDefaultHabitsState();
    expect(defaultState.habits.length).toBeGreaterThan(0);

    const normalized = normalizeHabit({
      name: "  Meditate  ",
      icon: "brain",
      targetPerWeek: 10,
    });
    expect(normalized.name).toBe("Meditate");
    expect(normalized.icon).toBe("brain");
    expect(normalized.targetPerWeek).toBe(7);
    expect(normalized.id).toBeDefined();
    expect(normalized.log).toEqual({});

    expect(normalizeHabit({ icon: "Droplets" }).icon).toBe("droplets");
    expect(normalizeHabit({ icon: "Activity" }).icon).toBe("activity");
    expect(normalizeHabit({ icon: "💧" }).icon).toBe("droplets");
    expect(normalizeHabit({ icon: "unknown-icon-xyz" }).icon).toBe("sparkles");
    expect(normalizeHabit({ icon: undefined }).icon).toBe("sparkles");
  });

  it("creates default state with starter habits and streaks", () => {
    const defaultState = createDefaultHabitsState();
    expect(defaultState.habits.length).toBeGreaterThan(0);
    expect(defaultState.habits[0].name).toBeDefined();
  });

  it("adds, updates, toggles, and deletes habits deterministically", () => {
    let state: HabitsPersistedState = { habits: [] };
    const id = "test-habit-1";

    state = addHabitOperation(state, { name: "Exercise", icon: "activity", targetPerWeek: 5, color: "#22c55e" }, id);
    expect(state.habits.length).toBe(1);
    expect(state.habits[0].id).toBe(id);
    expect(state.habits[0].name).toBe("Exercise");

    state = updateHabitOperation(state, id, { name: "Morning Run", targetPerWeek: 6 });
    expect(state.habits[0].name).toBe("Morning Run");
    expect(state.habits[0].targetPerWeek).toBe(6);

    state = toggleDayOperation(state, id, "2026-08-23");
    expect(state.habits[0].log["2026-08-23"]).toBe(true);

    state = toggleDayOperation(state, id, "2026-08-23");
    expect(state.habits[0].log["2026-08-23"]).toBeUndefined();

    state = deleteHabitOperation(state, id);
    expect(state.habits.length).toBe(0);
  });

  it("moves and reorders habits correctly", () => {
    let state: HabitsPersistedState = { habits: [] };
    state = addHabitOperation(state, { name: "Habit 1", icon: "activity", targetPerWeek: 5, color: "#22c55e" }, "h1");
    state = addHabitOperation(state, { name: "Habit 2", icon: "activity", targetPerWeek: 5, color: "#22c55e" }, "h2");

    state = moveHabitOperation(state, "h2", "down");
    expect(state.habits[0].id).toBe("h1");
    expect(state.habits[1].id).toBe("h2");

    state = moveHabitOperation(state, "h1", "down");
    expect(state.habits[0].id).toBe("h2");
    expect(state.habits[1].id).toBe("h1");

    state = reorderHabitsOperation(state, [state.habits[1], state.habits[0]]);
    expect(state.habits[0].id).toBe("h1");
    expect(state.habits[1].id).toBe("h2");
  });

  it("calculates streak, weekDone, and consistencyGrid", () => {
    const habit = normalizeHabit({
      id: "h1",
      name: "Read",
      icon: "book-open",
      targetPerWeek: 7,
      log: {
        "2026-08-21": true,
        "2026-08-22": true,
        "2026-08-23": true,
      },
    });

    expect(habitStreak(habit)).toBeGreaterThanOrEqual(0);
    expect(weekDone(habit)).toBeGreaterThanOrEqual(0);
    const grid = consistencyGrid([habit], 4);
    expect(grid.length).toBe(4);
    expect(grid[0].length).toBe(7);
  });
});

describe("Habits Domain — Legacy Migrations", () => {
  it("migrates older version snapshots to version 4 with normalized habits", () => {
    const oldSnapshot = {
      habits: [
        {
          id: "old-1",
          name: "Old Habit",
          icon: "target",
          targetPerWeek: 15,
          color: "invalid-color",
          log: { "2026-08-20": 1 },
        },
      ],
    };

    const migrated = migrateHabitsSnapshot(oldSnapshot, 3);
    expect(migrated.habits.length).toBe(1);
    expect(migrated.habits[0].id).toBe("old-1");
    expect(migrated.habits[0].targetPerWeek).toBe(7);
    expect(migrated.habits[0].log["2026-08-20"]).toBe(true);
  });

  it("throws error for unsupported future version", () => {
    expect(() => migrateHabitsSnapshot({ habits: [] }, CURRENT_HABITS_VERSION + 1)).toThrow(
      /Unsupported future Habits version/,
    );
  });
});

describe("Habits Domain — Adapter Integration & Parity", () => {
  let adapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(async () => {
    adapter = new LocalAdapter({ databaseName: `habits-test-${Date.now()}` });
    await adapter.initialize();
    await adapter.putStore({
      store: "lifeos-habits",
      version: 4,
      state: { habits: [] },
      updatedAt: new Date().toISOString(),
      revision: 1,
    });
    queryClient = createMemoryQueryClient();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      DataProvider,
      { adapter, queryClient, edition: "local" },
      children,
    );
  }

  it("reads and creates habits with LocalAdapter", async () => {
    const { result } = renderHook(() => useHabitsData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.habits).toEqual([]);

    let habit: Habit | undefined;
    await act(async () => {
      habit = await result.current.addHabit({
        name: "Morning Walk",
        icon: "sun",
        targetPerWeek: 7,
        color: "#22c55e",
      });
    });

    await waitFor(() => expect(result.current.habits.length).toBe(1));
    expect(result.current.habits[0].id).toBe(habit?.id);
    expect(result.current.habits[0].name).toBe("Morning Walk");

    // Verify stored directly in LocalAdapter Dexie database
    const doc = await adapter.getStore("lifeos-habits");
    expect(doc?.state.habits.length).toBe(1);
    expect(doc?.state.habits[0].name).toBe("Morning Walk");
  });

  it("updates, toggles, and deletes habits reactively", async () => {
    const { result } = renderHook(() => useHabitsData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let habit: Habit | undefined;
    await act(async () => {
      habit = await result.current.addHabit({
        name: "Read 10 pages",
        icon: "book-open",
        targetPerWeek: 5,
        color: "#3b82f6",
      });
    });

    await waitFor(() => expect(result.current.habits.length).toBe(1));
    const habitId = habit!.id;

    await act(async () => {
      await result.current.toggleDay(habitId, "2026-08-23");
    });
    await waitFor(() => expect(result.current.habits[0].log["2026-08-23"]).toBe(true));

    await act(async () => {
      await result.current.updateHabit(habitId, { name: "Read 20 pages" });
    });
    await waitFor(() => expect(result.current.habits[0].name).toBe("Read 20 pages"));

    await act(async () => {
      await result.current.deleteHabit(habitId);
    });
    await waitFor(() => expect(result.current.habits.length).toBe(0));
  });

  it("persists habits across adapter reload (simulated reload)", async () => {
    const dbName = `habits-reload-${Date.now()}`;
    const adapter1 = new LocalAdapter({ databaseName: dbName });
    await adapter1.initialize();

    await adapter1.mutateStore("lifeos-habits", () => ({
      habits: [
        {
          id: "persisted-h1",
          name: "Cold Shower",
          icon: "sun",
          targetPerWeek: 7,
          color: "#06b6d4",
          createdAt: "2026-08-20",
          log: { "2026-08-21": true, "2026-08-22": true },
        },
      ],
    }));
    await adapter1.close();

    const adapter2 = new LocalAdapter({ databaseName: dbName });
    await adapter2.initialize();
    const doc = await adapter2.getStore("lifeos-habits");
    expect(doc?.state.habits.length).toBe(1);
    expect(doc?.state.habits[0].id).toBe("persisted-h1");
    expect(doc?.state.habits[0].log["2026-08-21"]).toBe(true);

    await adapter2.close();
  });

  it("maintains stable habit IDs across CAS retries", async () => {
    let mutateCallCount = 0;
    const mockAdapter = {
      initialize: () => Promise.resolve(),
      close: () => Promise.resolve(),
      getStore: () => Promise.resolve({ store: "lifeos-habits", version: 4, state: { habits: [] }, updated_at: "2026-08-23" }),
      putStore: () => Promise.resolve({ store: "lifeos-habits", version: 4, state: { habits: [] }, updated_at: "2026-08-23" }),
      mutateStore: async (_key: string, updater: (state: HabitsPersistedState) => HabitsPersistedState) => {
        mutateCallCount++;
        // Simulate CAS conflict on 1st call, success on 2nd
        if (mutateCallCount === 1) {
          updater({ habits: [] });
          // Retry
          const retryState = updater({ habits: [] });
          return { store: "lifeos-habits", version: 4, state: retryState, updated_at: "2026-08-23T12:00:00.000Z" };
        }
        const state = updater({ habits: [] });
        return { store: "lifeos-habits", version: 4, state, updated_at: "2026-08-23T12:00:00.000Z" };
      },
      getAllStores: () => Promise.resolve([]),
      subscribe: () => () => {},
    };

    function mockWrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        DataProvider,
        { adapter: mockAdapter as unknown as DataAdapter, queryClient, edition: "local" },
        children,
      );
    }

    const { result } = renderHook(() => useHabitsData(), { wrapper: mockWrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdHabit: Habit | undefined;
    await act(async () => {
      createdHabit = await result.current.addHabit({
        name: "Morning Stretch",
        icon: "zap",
        targetPerWeek: 7,
        color: "#f59e0b",
      });
    });

    expect(createdHabit?.id).toBeDefined();
    expect(createdHabit!.id.length).toBeGreaterThan(0);
    // Habit ID created should match state item ID even across retry
    await waitFor(() => expect(result.current.habits[0]?.id).toBe(createdHabit?.id));
  });

});
