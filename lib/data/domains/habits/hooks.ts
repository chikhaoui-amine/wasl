"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  useDataAdapter,
  useDataEdition,
  useDataUserId,
} from "../../query/provider";
import { queryKeys } from "../../query/keys";
import { useSerializedMutations } from "../../query/mutation-queue";
import { deleteEntityWithTrash } from "../trash";
import {
  createDefaultHabitsState,
  normalizeHabitsState,
  addHabitOperation,
  updateHabitOperation,
  toggleDayOperation,
  deleteHabitOperation,
  moveHabitOperation,
  reorderHabitsOperation,
} from "./operations";
import type { Habit } from "./types";
import { todayISO } from "@/lib/date";

export function useHabitsData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, "lifeos-habits");
  const enqueue = useSerializedMutations();

  const query = useQuery({
    queryKey,
    enabled: !!adapter,
    queryFn: async () => {
      if (!adapter) return createDefaultHabitsState();
      const doc = await adapter.getStore("lifeos-habits");
      return doc ? doc.state : createDefaultHabitsState();
    },
  });

  const mutation = useMutation({
    mutationFn: async (updater: (state: ReturnType<typeof createDefaultHabitsState>) => ReturnType<typeof createDefaultHabitsState>) => {
      if (!adapter) {
        throw new Error("No active data adapter available for Habits mutation.");
      }
      return enqueue(async () => {
        const doc = await adapter.mutateStore("lifeos-habits", (current) => {
          return updater(current || createDefaultHabitsState());
        });
        return doc.state;
      });
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(queryKey, newState);
    },
  });

  const addHabit = async (
    input: Omit<Habit, "id" | "log" | "createdAt"> & Partial<Pick<Habit, "log" | "createdAt">>,
  ): Promise<Habit> => {
    // Generate stable ID before mutateStore to ensure determinism across CAS retries
    const preGeneratedId = crypto.randomUUID();
    const newHabit: Habit = {
      id: preGeneratedId,
      log: input.log || {},
      createdAt: input.createdAt || todayISO(),
      name: input.name,
      icon: input.icon,
      targetPerWeek: input.targetPerWeek,
      color: input.color,
    };

    await mutation.mutateAsync((current) => addHabitOperation(current, newHabit, preGeneratedId));
    return newHabit;
  };

  const updateHabit = async (
    id: string,
    patch: Partial<Omit<Habit, "id">>,
  ): Promise<void> => {
    await mutation.mutateAsync((current) => updateHabitOperation(current, id, patch));
  };

  const toggleDay = async (id: string, iso: string = todayISO()): Promise<void> => {
    await mutation.mutateAsync((current) => toggleDayOperation(current, id, iso));
  };

  const deleteHabit = async (id: string): Promise<void> => {
    let targetHabit = (query.data?.habits ?? []).find((h) => h.id === id);
    if (!targetHabit && adapter) {
      const doc = await adapter.getStore("lifeos-habits");
      const docState = normalizeHabitsState(doc?.state);
      targetHabit = docState.habits.find((h) => h.id === id);
    }
    if (targetHabit && adapter) {
      await deleteEntityWithTrash(adapter, {
        itemType: "habit",
        entity: targetHabit,
        title: targetHabit.name || "Untitled Habit",
        originalStoreKey: "lifeos-habits",
        deleteFromSource: async () => {
          await mutation.mutateAsync((current) => deleteHabitOperation(current, id));
        },
      });
    } else {
      await mutation.mutateAsync((current) => deleteHabitOperation(current, id));
    }
  };

  const moveHabit = async (id: string, direction: "up" | "down"): Promise<void> => {
    await mutation.mutateAsync((current) => moveHabitOperation(current, id, direction));
  };

  const reorderHabits = async (newOrder: Habit[]): Promise<void> => {
    await mutation.mutateAsync((current) => reorderHabitsOperation(current, newOrder));
  };

  const habits = query.data?.habits ?? [];

  return {
    habits,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isMutating: mutation.isPending,
    addHabit,
    updateHabit,
    toggleDay,
    deleteHabit,
    moveHabit,
    reorderHabits,
    refetch: query.refetch,
  };
}
