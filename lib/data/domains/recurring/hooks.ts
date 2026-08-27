"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataAdapter, useDataEdition, useDataUserId } from "../../query/provider";
import { queryKeys } from "../../query/keys";
import { useSerializedMutations } from "../../query/mutation-queue";
import type { RecurringPersistedState } from "../../types";
import { todayISO } from "@/lib/date";
import {
  createDefaultRecurringState,
  normalizeRecurringState,
  addRecurringOperation,
  updateRecurringOperation,
  toggleOccurrenceOperation,
  deleteRecurringOperation,
  type RecurringTask,
  type RecurringTaskInput,
} from "./operations";

const STORE_KEY = "lifeos-recurring" as const;

export function useRecurringData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, STORE_KEY);
  const enqueue = useSerializedMutations();


  const { data, isLoading, error } = useQuery<RecurringPersistedState, Error>({
    queryKey,
    queryFn: async () => {
      if (!adapter) {
        return createDefaultRecurringState();
      }
      const doc = await adapter.getStore(STORE_KEY);
      return normalizeRecurringState(doc?.state);
    },
    enabled: !!adapter,
  });

  const mutation = useMutation<
    RecurringPersistedState,
    Error,
    (current: RecurringPersistedState) => RecurringPersistedState
  >({
    mutationFn: async (updater) => {
      if (!adapter) {
        throw new Error("No data adapter available for recurring mutation.");
      }
      return enqueue(async () => {
          const res = await adapter.mutateStore(STORE_KEY, (prev) => {
            const base = normalizeRecurringState(prev);
            return updater(base);
          });
          return normalizeRecurringState(res.state);
      });
    },
    onSuccess: (nextState) => {
      queryClient.setQueryData(queryKey, nextState);
    },
  });

  const state = data ?? createDefaultRecurringState();

  const addRecurring = useCallback(
    async (input: RecurringTaskInput): Promise<RecurringTask> => {
      const pregeneratedId = crypto.randomUUID();
      const newTask: RecurringTask = {
        id: pregeneratedId,
        completions: {},
        createdAt: todayISO(),
        ...input,
      };

      await mutation.mutateAsync((current) => addRecurringOperation(current, newTask));
      return newTask;
    },
    [mutation],
  );

  const updateRecurring = useCallback(
    async (id: string, patch: Partial<RecurringTaskInput>): Promise<void> => {
      await mutation.mutateAsync((current) => updateRecurringOperation(current, id, patch));
    },
    [mutation],
  );

  const toggleOccurrence = useCallback(
    async (id: string, iso: string): Promise<void> => {
      await mutation.mutateAsync((current) => toggleOccurrenceOperation(current, id, iso));
    },
    [mutation],
  );

  const deleteRecurring = useCallback(
    async (id: string): Promise<void> => {
      await mutation.mutateAsync((current) => deleteRecurringOperation(current, id));
    },
    [mutation],
  );

  return {
    recurring: state.recurring,
    isLoading,
    error,
    edition,
    addRecurring,
    updateRecurring,
    toggleOccurrence,
    deleteRecurring,
  };
}
