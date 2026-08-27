"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataAdapter, useDataEdition, useDataUserId } from "../../query/provider";
import { queryKeys } from "../../query/keys";
import { useSerializedMutations } from "../../query/mutation-queue";
import type { GoalsPersistedState } from "../../types";
import { deleteEntityWithTrash } from "../trash";
import {
  createDefaultGoalsState,
  normalizeGoalsState,
  addGoalOperation,
  updateGoalOperation,
  deleteGoalOperation,
  addMilestoneOperation,
  updateMilestoneOperation,
  toggleMilestoneOperation,
  deleteMilestoneOperation,
  moveMilestoneOperation,
  reorderMilestonesOperation,
  toggleGoalDoneOperation,
  mapLegacyCategoryToNorthStar,
  type Goal,
  type GoalInput,
  type Milestone,
} from "./operations";

const STORE_KEY = "lifeos-goals" as const;

export function useGoalsData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, STORE_KEY);
  const enqueue = useSerializedMutations();


  const { data, isLoading, error } = useQuery<GoalsPersistedState, Error>({
    queryKey,
    queryFn: async () => {
      if (!adapter) {
        return createDefaultGoalsState();
      }
      const doc = await adapter.getStore(STORE_KEY);
      return normalizeGoalsState(doc?.state);
    },
    enabled: !!adapter,
  });

  const mutation = useMutation<
    GoalsPersistedState,
    Error,
    (current: GoalsPersistedState) => GoalsPersistedState
  >({
    mutationFn: async (updater) => {
      if (!adapter) {
        throw new Error("No data adapter available for goals mutation.");
      }
      return enqueue(async () => {
          const res = await adapter.mutateStore(STORE_KEY, (prev) => {
            const base = normalizeGoalsState(prev);
            return updater(base);
          });
          return normalizeGoalsState(res.state);
      });
    },
    onSuccess: (nextState) => {
      queryClient.setQueryData(queryKey, nextState);
    },
  });

  const state = data ?? createDefaultGoalsState();

  const addGoal = useCallback(
    async (input: GoalInput): Promise<Goal> => {
      const pregeneratedId = crypto.randomUUID();
      const northStarId = input.northStarId || mapLegacyCategoryToNorthStar(input.category);
      const newGoal: Goal = {
        id: pregeneratedId,
        plan: "",
        milestones: input.milestones ?? [],
        manualProgress: input.manualProgress ?? 0,
        completed: input.status === "completed",
        category: northStarId,
        type: input.type ?? "yearly_outcome",
        status: input.status ?? "active",
        northStarId,
        isCurrentFocus: input.isCurrentFocus ?? false,
        linkedOutcomeId: input.linkedOutcomeId,
        ...input,
      };

      await mutation.mutateAsync((current) => addGoalOperation(current, newGoal));
      return newGoal;
    },
    [mutation],
  );

  const updateGoal = useCallback(
    async (id: string, patch: Partial<Omit<Goal, "id">>): Promise<void> => {
      await mutation.mutateAsync((current) => updateGoalOperation(current, id, patch));
    },
    [mutation],
  );

  const deleteGoal = useCallback(
    async (id: string): Promise<void> => {
      let targetGoal = state.goals.find((g) => g.id === id);
      if (!targetGoal && adapter) {
        const doc = await adapter.getStore(STORE_KEY);
        const docState = normalizeGoalsState(doc?.state);
        targetGoal = docState.goals.find((g) => g.id === id);
      }

      if (targetGoal && adapter) {
        // Moving to Trash is a prerequisite for deletion.
        await deleteEntityWithTrash(adapter, {
          itemType: "goal",
          entity: targetGoal,
          title: targetGoal.title,
          description: targetGoal.why,
          originalStoreKey: STORE_KEY,
          deleteFromSource: async () => {
            await mutation.mutateAsync((current) => deleteGoalOperation(current, id));
          },
        });
      } else {
        await mutation.mutateAsync((current) => deleteGoalOperation(current, id));
      }
    },
    [state.goals, adapter, mutation],
  );

  const addMilestone = useCallback(
    async (goalId: string, title: string): Promise<Milestone> => {
      const milestone: Milestone = {
        id: crypto.randomUUID(),
        title: title.trim(),
        done: false,
      };
      await mutation.mutateAsync((current) => addMilestoneOperation(current, goalId, milestone));
      return milestone;
    },
    [mutation],
  );

  const updateMilestone = useCallback(
    async (goalId: string, id: string, title: string): Promise<void> => {
      await mutation.mutateAsync((current) => updateMilestoneOperation(current, goalId, id, title));
    },
    [mutation],
  );

  const toggleMilestone = useCallback(
    async (goalId: string, id: string): Promise<void> => {
      await mutation.mutateAsync((current) => toggleMilestoneOperation(current, goalId, id));
    },
    [mutation],
  );

  const deleteMilestone = useCallback(
    async (goalId: string, id: string): Promise<void> => {
      await mutation.mutateAsync((current) => deleteMilestoneOperation(current, goalId, id));
    },
    [mutation],
  );

  const moveMilestone = useCallback(
    async (goalId: string, id: string, direction: "up" | "down"): Promise<void> => {
      await mutation.mutateAsync((current) => moveMilestoneOperation(current, goalId, id, direction));
    },
    [mutation],
  );

  const reorderMilestones = useCallback(
    async (goalId: string, milestones: Milestone[]): Promise<void> => {
      await mutation.mutateAsync((current) => reorderMilestonesOperation(current, goalId, milestones));
    },
    [mutation],
  );

  const toggleGoalDone = useCallback(
    async (id: string): Promise<void> => {
      await mutation.mutateAsync((current) => toggleGoalDoneOperation(current, id));
    },
    [mutation],
  );

  return {
    goals: state.goals,
    isLoading,
    error,
    edition,
    addGoal,
    updateGoal,
    deleteGoal,
    addMilestone,
    updateMilestone,
    toggleMilestone,
    deleteMilestone,
    moveMilestone,
    reorderMilestones,
    toggleGoalDone,
  };
}
