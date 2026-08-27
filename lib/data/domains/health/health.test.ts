// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { LocalAdapter } from "../../adapters/local/local-adapter";
import { DataProvider, createMemoryQueryClient } from "../../query/provider";
import type { DataAdapter, HealthPersistedState } from "../../types";
import { useHealthData } from "./hooks";
import {
  createDefaultHealthState,
  patchDayOperation,
  addWorkoutOperation,
  deleteWorkoutOperation,
  addExerciseOperation,
  addProgramOperation,
  updateProgramOperation,
  deleteProgramOperation,
  DEFAULT_EXERCISES,
  DEFAULT_PROGRAMS,
  weightSeries,
  getDisplayedWorkoutSeconds,
} from "./operations";
import { migrateHealthSnapshot, CURRENT_HEALTH_VERSION } from "./migrations";
import type { Workout } from "./types";

describe("Health Domain — Pure Operations", () => {
  it("creates clean default state with exercises, programs, and sample activity", () => {
    const defaultState = createDefaultHealthState();
    expect(Object.keys(defaultState.days).length).toBeGreaterThan(0);
    expect(defaultState.workouts.length).toBeGreaterThan(0);
    expect(defaultState.programs.length).toBeGreaterThan(0);
    expect(defaultState.exercises?.length).toBeGreaterThan(0);
    expect(defaultState.activeWorkout).toBeNull();
  });

  it("patches health day metrics and computes weight series correctly", () => {
    let state: HealthPersistedState = {
      days: {},
      workouts: [],
      customSports: [],
      exercises: DEFAULT_EXERCISES,
      programs: DEFAULT_PROGRAMS,
      goals: { steps: 8000, waterCups: 8, sleepH: 8, sessionsPerWeek: 3 },
      activeWorkout: null,
    };
    state = patchDayOperation(
      state,
      {
        sleepH: 7.5,
        sleepQuality: "Great",
        weightKg: 72.4,
        waterCups: 8,
        steps: 10500,
      },
      "2026-08-23",
    );

    expect(state.days["2026-08-23"].sleepH).toBe(7.5);
    expect(state.days["2026-08-23"].sleepQuality).toBe("Great");
    expect(state.days["2026-08-23"].weightKg).toBe(72.4);
    expect(state.days["2026-08-23"].steps).toBe(10500);

    const weights = weightSeries(state.days);
    expect(weights.length).toBe(1);
    expect(weights[0].value).toBe(72.4);
  });

  it("adds and deletes workouts deterministically", () => {
    let state: HealthPersistedState = {
      days: {},
      workouts: [],
      customSports: [],
      exercises: DEFAULT_EXERCISES,
      programs: DEFAULT_PROGRAMS,
      goals: { steps: 8000, waterCups: 8, sleepH: 8, sessionsPerWeek: 3 },
      activeWorkout: null,
    };
    const workoutId = "w-test-1";
    const workout: Workout = {
      id: workoutId,
      date: "2026-08-23",
      sport: "Gym",
      minutes: 45,
      note: "Push Day",
    };

    state = addWorkoutOperation(state, workout);
    expect(state.workouts.length).toBe(1);
    expect(state.workouts[0].id).toBe(workoutId);

    state = deleteWorkoutOperation(state, workoutId);
    expect(state.workouts.length).toBe(0);
  });

  it("adds custom exercises and manages programs", () => {
    let state = createDefaultHealthState();
    const customEx = {
      id: "ex-custom-1",
      name: "Cable Lateral Raise",
      category: "Gym" as const,
      primaryMuscle: "Side Delts",
      equipment: "Cable" as const,
    };

    state = addExerciseOperation(state, customEx);
    expect(state.exercises?.some((e) => e.id === "ex-custom-1")).toBe(true);

    const newProg = {
      id: "prog-custom-1",
      name: "Custom 3-Day Split",
      description: "Push Pull Legs",
      sport: "Gym",
      sessions: [],
    };

    state = addProgramOperation(state, newProg);
    expect(state.programs.some((p) => p.id === "prog-custom-1")).toBe(true);

    state = updateProgramOperation(state, "prog-custom-1", { name: "Custom 4-Day Split" });
    expect(state.programs.find((p) => p.id === "prog-custom-1")?.name).toBe("Custom 4-Day Split");

    state = deleteProgramOperation(state, "prog-custom-1");
    expect(state.programs.some((p) => p.id === "prog-custom-1")).toBe(false);
  });
});

describe("Health Domain — Legacy Migrations", () => {
  it("migrates older version snapshots (< v6) to version 6 with default exercises and programs fallback", () => {
    const oldSnapshot = {
      days: {
        "2026-08-20": {
          weightKg: 75,
          sleepH: 8,
        },
      },
      workouts: [
        {
          id: "w-old-1",
          date: "2026-08-20",
          sport: "Gym",
          minutes: 50,
          notes: "Leg Day",
        },
      ],
    };

    const migrated = migrateHealthSnapshot(oldSnapshot, 5);
    expect(migrated.days["2026-08-20"].weightKg).toBe(75);
    expect(migrated.workouts.length).toBe(1);
    expect(migrated.workouts[0].id).toBe("w-old-1");
    expect(migrated.exercises?.length).toBeGreaterThan(0);
    expect(migrated.programs.length).toBeGreaterThan(0);
    expect(migrated.goals?.steps).toBe(8000);
  });

  it("throws error for unsupported future version", () => {
    expect(() => migrateHealthSnapshot({ days: {} }, CURRENT_HEALTH_VERSION + 1)).toThrow(
      /Unsupported future Health version/,
    );
  });
});

describe("Health Domain — Adapter Integration & Parity", () => {
  let adapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(async () => {
    adapter = new LocalAdapter({ databaseName: `health-test-${Date.now()}` });
    await adapter.initialize();
    await adapter.putStore({
      store: "lifeos-health",
      version: 6,
      state: {
        days: {},
        workouts: [],
        customSports: [],
        exercises: DEFAULT_EXERCISES,
        programs: DEFAULT_PROGRAMS,
        goals: { steps: 8000, waterCups: 8, sleepH: 8, sessionsPerWeek: 3 },
        activeWorkout: null,
      },
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

  it("reads and updates health metrics with LocalAdapter", async () => {
    const { result } = renderHook(() => useHealthData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.patchDay(
        {
          weightKg: 73.5,
          sleepH: 8.2,
        },
        "2026-08-23",
      );
    });

    await waitFor(() => expect(result.current.days["2026-08-23"]?.weightKg).toBe(73.5));

    // Verify stored directly in LocalAdapter Dexie database
    const doc = await adapter.getStore("lifeos-health");
    expect(doc?.state.days["2026-08-23"]?.weightKg).toBe(73.5);
    expect(doc?.state.days["2026-08-23"]?.sleepH).toBe(8.2);
  });

  it("persists health state across adapter reload (simulated reload)", async () => {
    const dbName = `health-reload-${Date.now()}`;
    const adapter1 = new LocalAdapter({ databaseName: dbName });
    await adapter1.initialize();

    await adapter1.mutateStore("lifeos-health", () => ({
      days: {
        "2026-08-23": {
          weightKg: 71.0,
          sleepH: 7.0,
          waterCups: 8,
          steps: 12000,
        },
      },
      workouts: [
        {
          id: "w-persisted-1",
          date: "2026-08-23",
          sport: "Running",
          minutes: 28,
          note: "5K Run",
        },
      ],
      customSports: ["Gym", "Running"],
      exercises: DEFAULT_EXERCISES,
      programs: DEFAULT_PROGRAMS,
      goals: { steps: 10000, waterCups: 8, sleepH: 8, sessionsPerWeek: 4 },
      activeWorkout: null,
    }));
    await adapter1.close();

    const adapter2 = new LocalAdapter({ databaseName: dbName });
    await adapter2.initialize();
    const doc = await adapter2.getStore("lifeos-health");
    expect(doc?.state.days["2026-08-23"].weightKg).toBe(71.0);
    expect(doc?.state.workouts[0].note).toBe("5K Run");

    await adapter2.close();
  });

  it("maintains stable workout IDs across CAS retries", async () => {
    let mutateCallCount = 0;
    const mockAdapter = {
      initialize: () => Promise.resolve(),
      close: () => Promise.resolve(),
      getStore: () => Promise.resolve({ store: "lifeos-health", version: 6, state: createDefaultHealthState(), updated_at: "2026-08-23" }),
      putStore: () => Promise.resolve({ store: "lifeos-health", version: 6, state: createDefaultHealthState(), updated_at: "2026-08-23" }),
      mutateStore: async (_key: string, updater: (state: HealthPersistedState) => HealthPersistedState) => {
        mutateCallCount++;
        // Simulate CAS retry
        if (mutateCallCount === 1) {
          updater(createDefaultHealthState());
          const retryState = updater(createDefaultHealthState());
          return { store: "lifeos-health", version: 6, state: retryState, updated_at: "2026-08-23T12:00:00.000Z" };
        }
        const state = updater(createDefaultHealthState());
        return { store: "lifeos-health", version: 6, state, updated_at: "2026-08-23T12:00:00.000Z" };
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

    const { result } = renderHook(() => useHealthData(), { wrapper: mockWrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdWorkout: Workout | undefined;
    await act(async () => {
      createdWorkout = await result.current.addWorkout({
        date: "2026-08-23",
        sport: "Gym",
        minutes: 60,
        note: "Leg Day",
      });
    });

    expect(createdWorkout?.id).toBeDefined();
    expect(createdWorkout!.id.length).toBeGreaterThan(0);
    await waitFor(() => expect(result.current.workouts.some((w) => w.id === createdWorkout?.id)).toBe(true));
  });
});
