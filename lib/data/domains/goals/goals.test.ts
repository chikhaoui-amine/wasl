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
import { useGoalsData } from "./hooks";
import {
  createDefaultGoalsState,
  addGoalOperation,
  updateGoalOperation,
  deleteGoalOperation,
  addMilestoneOperation,
  toggleMilestoneOperation,
  deleteMilestoneOperation,
  moveMilestoneOperation,
  toggleGoalDoneOperation,
  goalProgress,
  trackState,
  mapLegacyCategoryToNorthStar,
  type Goal,
} from "./operations";
import type { GoalsPersistedState } from "../../types";
import { migrateGoalsSnapshot, CURRENT_GOALS_VERSION } from "./migrations";

describe("Goals Domain — Pure Operations & Helpers", () => {
  it("creates default state and normalizes legacy categories", () => {
    const state = createDefaultGoalsState();
    expect(state.goals.length).toBeGreaterThan(0);
    expect(mapLegacyCategoryToNorthStar("Career")).toBe("career_work");
    expect(mapLegacyCategoryToNorthStar("Fitness")).toBe("health_fitness");
    expect(mapLegacyCategoryToNorthStar("UnknownCat")).toBe("personal_growth");
  });

  it("adds, updates, toggles done, and deletes goals", () => {
    const initial: GoalsPersistedState = { goals: [] };
    const goal: Goal = {
      id: "goal-1",
      title: "Launch WASL Next",
      plan: "Full local-first migration",
      milestones: [{ id: "m-1", title: "Batch D complete", done: false }],
      manualProgress: 0,
      completed: false,
      category: "business_finance",
      type: "yearly_outcome",
      status: "active",
      northStarId: "business_finance",
      isCurrentFocus: true,
    };

    const added = addGoalOperation(initial, goal);
    expect(added.goals.length).toBe(1);
    expect(added.goals[0].title).toBe("Launch WASL Next");

    // Toggle milestone
    const withToggledMilestone = toggleMilestoneOperation(added, "goal-1", "m-1");
    expect(withToggledMilestone.goals[0].milestones[0].done).toBe(true);

    // Update goal
    const updated = updateGoalOperation(withToggledMilestone, "goal-1", {
      title: "Launch WASL Local & Cloud",
    });
    expect(updated.goals[0].title).toBe("Launch WASL Local & Cloud");

    // Toggle goal done
    const doneState = toggleGoalDoneOperation(updated, "goal-1");
    expect(doneState.goals[0].completed).toBe(true);
    expect(doneState.goals[0].status).toBe("completed");

    // Delete goal
    const deleted = deleteGoalOperation(doneState, "goal-1");
    expect(deleted.goals.length).toBe(0);
  });

  it("handles milestone management: adding, moving, and deleting", () => {
    let state: GoalsPersistedState = { goals: [] };
    const goal: Goal = {
      id: "goal-m",
      title: "Milestone Test",
      plan: "",
      milestones: [
        { id: "m-1", title: "Step 1", done: true },
        { id: "m-2", title: "Step 2", done: false },
      ],
      manualProgress: 0,
      completed: false,
      category: "personal_capability",
      type: "yearly_outcome",
      status: "active",
      northStarId: "personal_capability",
      isCurrentFocus: false,
    };
    state = addGoalOperation(state, goal);

    state = addMilestoneOperation(state, "goal-m", { id: "m-3", title: "Step 3", done: false });
    expect(state.goals[0].milestones.length).toBe(3);

    // Move milestone up
    state = moveMilestoneOperation(state, "goal-m", "m-3", "up");
    expect(state.goals[0].milestones[1].id).toBe("m-3");

    // Delete milestone
    state = deleteMilestoneOperation(state, "goal-m", "m-1");
    expect(state.goals[0].milestones.length).toBe(2);
  });

  it("calculates progress and track status correctly", () => {
    const goalWithMilestones: Goal = {
      id: "g-p",
      title: "Progress Calc",
      plan: "",
      milestones: [
        { id: "m-1", title: "1", done: true },
        { id: "m-2", title: "2", done: false },
      ],
      manualProgress: 20,
      completed: false,
      category: "personal_capability",
      type: "yearly_outcome",
      status: "active",
      northStarId: "personal_capability",
      isCurrentFocus: false,
    };
    // 1 of 2 milestones done = 50%
    expect(goalProgress(goalWithMilestones)).toBe(50);

    const goalWithoutMilestones: Goal = {
      ...goalWithMilestones,
      milestones: [],
      manualProgress: 65,
    };
    expect(goalProgress(goalWithoutMilestones)).toBe(65);

    expect(trackState(goalWithMilestones, 100)).toBe("done");
  });
});

describe("Goals Domain — Migrations", () => {
  it("migrates older version snapshots (< v6) smoothly", () => {
    const oldSnapshot = {
      goals: [
        {
          id: "g-old",
          title: "Legacy Project",
          type: "project",
          category: "Career",
          completed: false,
        },
      ],
    };

    const migrated = migrateGoalsSnapshot(oldSnapshot, 5);
    expect(migrated.goals.length).toBe(1);
    expect(migrated.goals[0].type).toBe("yearly_outcome");
    expect(migrated.goals[0].category).toBe("career_work");
    expect(migrated.goals[0].northStarId).toBe("career_work");
    expect(migrated.goals[0].status).toBe("active");
  });

  it("throws error for unsupported future version", () => {
    expect(() => migrateGoalsSnapshot({ goals: [] }, CURRENT_GOALS_VERSION + 1)).toThrow();
  });
});

describe("Goals Domain — Adapter Integration, Serialization & Trash Bridge", () => {
  let localAdapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(async () => {
    testLocalStorage.clear();
    localAdapter = new LocalAdapter({ databaseName: `test-goals-db-${Date.now()}` });
    await localAdapter.initialize();
    await localAdapter.putStore({
      store: "lifeos-goals",
      version: 6,
      state: { goals: [] },
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

  it("reads, adds, updates goals and bridges delete to Trash", async () => {
    const { result } = renderHook(() => useGoalsData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdGoal!: Goal;
    await act(async () => {
      createdGoal = await result.current.addGoal({
        title: "Master TypeScript & React",
        category: "business_finance",
      });
    });

    expect(createdGoal.id).toBeDefined();
    await waitFor(() => expect(result.current.goals.length).toBe(1));

    // Add milestone
    await act(async () => {
      await result.current.addMilestone(createdGoal.id, "Complete Batch D");
    });
    await waitFor(() => expect(result.current.goals[0].milestones.length).toBe(1));

    // Delete goal -> bridges to Trash
    await act(async () => {
      await result.current.deleteGoal(createdGoal.id);
    });
    await waitFor(() => expect(result.current.goals.length).toBe(0));

    const trashDoc = await localAdapter.getStore("lifeos-trash");
    const trashItems = (trashDoc?.state?.items as Array<{ originalStoreKey: string; title: string }>) || [];
    const trashed = trashItems.find((i) => i.originalStoreKey === "lifeos-goals");
    expect(trashed).toBeDefined();
    expect(trashed?.title).toBe("Master TypeScript & React");
  });

  it("aborts deletion and preserves the goal if Trash throws an error", async () => {
    const { result } = renderHook(() => useGoalsData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdGoal!: Goal;
    await act(async () => {
      createdGoal = await result.current.addGoal({
        title: "Indestructible Goal",
        category: "athletic_body",
      });
    });

    await waitFor(() => expect(result.current.goals.length).toBe(1));

    const originalMutate = localAdapter.mutateStore.bind(localAdapter);
    vi.spyOn(localAdapter, "mutateStore").mockImplementation(async (key: any, updater: any) => {
      if (key === "lifeos-trash") {
        throw new Error("Trash quota full");
      }
      return (originalMutate as any)(key, updater);
    });

    await expect(
      act(async () => {
        await result.current.deleteGoal(createdGoal.id);
      }),
    ).rejects.toThrow("Trash quota full");

    expect(result.current.goals.length).toBe(1);
    expect(result.current.goals[0].id).toBe(createdGoal.id);

    const doc = await localAdapter.getStore("lifeos-goals");
    expect(doc?.state.goals.some((g: Goal) => g.id === createdGoal.id)).toBe(true);
  });
});
