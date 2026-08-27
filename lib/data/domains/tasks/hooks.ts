"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataAdapter, useDataEdition, useDataUserId } from "../../query/provider";
import { queryKeys } from "../../query/keys";
import { useSerializedMutations } from "../../query/mutation-queue";
import type { TasksPersistedState } from "../../types";
import { deleteEntityWithTrash } from "../trash";
import { todayISO } from "@/lib/date";
import {
  createDefaultTasksState,
  normalizeTasksState,
  addTaskOperation,
  updateTaskOperation,
  toggleTaskOperation,
  deleteTaskOperation,
  initializeDailyFocusOperation,
  setDailyFocusTaskOperation,
  type Task,
  type TaskInput,
} from "./operations";

const STORE_KEY = "lifeos-tasks" as const;

export function useTasksData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, STORE_KEY);
  const enqueue = useSerializedMutations();


  const { data, isLoading, error } = useQuery<TasksPersistedState, Error>({
    queryKey,
    queryFn: async () => {
      if (!adapter) {
        return createDefaultTasksState();
      }
      const doc = await adapter.getStore(STORE_KEY);
      return normalizeTasksState(doc?.state);
    },
    enabled: !!adapter,
  });

  const mutation = useMutation<
    TasksPersistedState,
    Error,
    (current: TasksPersistedState) => TasksPersistedState
  >({
    mutationFn: async (updater) => {
      if (!adapter) {
        throw new Error("No data adapter available for tasks mutation.");
      }
      return enqueue(async () => {
          const res = await adapter.mutateStore(STORE_KEY, (prev) => {
            const base = normalizeTasksState(prev);
            return updater(base);
          });
          return normalizeTasksState(res.state);
      });
    },
    onSuccess: (nextState) => {
      queryClient.setQueryData(queryKey, nextState);
    },
  });

  const state = data ?? createDefaultTasksState();

  const addTask = useCallback(
    async (input: TaskInput): Promise<Task> => {
      const pregeneratedId = crypto.randomUUID();
      const createdAt = todayISO();
      const newTask: Task = {
        id: pregeneratedId,
        status: "todo",
        createdAt,
        ...input,
      };

      await mutation.mutateAsync((current) => addTaskOperation(current, newTask));
      return newTask;
    },
    [mutation],
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<TaskInput>): Promise<void> => {
      await mutation.mutateAsync((current) => updateTaskOperation(current, id, patch));
    },
    [mutation],
  );

  const toggleTask = useCallback(
    async (id: string): Promise<void> => {
      await mutation.mutateAsync((current) => toggleTaskOperation(current, id));
    },
    [mutation],
  );

  const deleteTask = useCallback(
    async (id: string): Promise<void> => {
      let targetTask = state.tasks.find((t) => t.id === id);
      if (!targetTask && adapter) {
        const doc = await adapter.getStore(STORE_KEY);
        const docState = normalizeTasksState(doc?.state);
        targetTask = docState.tasks.find((t) => t.id === id);
      }

      if (targetTask && adapter) {
        // Moving to Trash is a prerequisite for deletion.
        await deleteEntityWithTrash(adapter, {
          itemType: "task",
          entity: targetTask,
          title: targetTask.title,
          description: targetTask.due ? `Due ${targetTask.due}` : undefined,
          originalStoreKey: STORE_KEY,
          deleteFromSource: async () => {
            await mutation.mutateAsync((current) => deleteTaskOperation(current, id));
          },
        });
      } else {
        await mutation.mutateAsync((current) => deleteTaskOperation(current, id));
      }
    },
    [state.tasks, adapter, mutation],
  );

  const initializeDailyFocus = useCallback(
    async (date: string): Promise<void> => {
      await mutation.mutateAsync((current) => initializeDailyFocusOperation(current, date));
    },
    [mutation],
  );

  const setDailyFocusTask = useCallback(
    async (date: string, slot: number, taskId: string): Promise<void> => {
      await mutation.mutateAsync((current) => setDailyFocusTaskOperation(current, date, slot, taskId));
    },
    [mutation],
  );

  return {
    tasks: state.tasks,
    dailyFocus: state.dailyFocus,
    isLoading,
    error,
    edition,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    initializeDailyFocus,
    setDailyFocusTask,
  };
}
