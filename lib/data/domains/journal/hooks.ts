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
import {
  createDefaultJournalState,
  addEntryOperation,
  updateEntryOperation,
  deleteEntryOperation,
} from "./operations";
import type { JournalEntry, Mood } from "./types";
import { todayISO } from "@/lib/date";

export function useJournalData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, "lifeos-journal");
  const enqueue = useSerializedMutations();

  const query = useQuery({
    queryKey,
    enabled: !!adapter,
    queryFn: async () => {
      if (!adapter) return createDefaultJournalState();
      const doc = await adapter.getStore("lifeos-journal");
      return doc ? doc.state : createDefaultJournalState();
    },
  });

  const mutation = useMutation({
    mutationFn: async (updater: (state: ReturnType<typeof createDefaultJournalState>) => ReturnType<typeof createDefaultJournalState>) => {
      if (!adapter) {
        throw new Error("No active data adapter available for Journal mutation.");
      }
      return enqueue(async () => {
        const doc = await adapter.mutateStore("lifeos-journal", (current) => {
          return updater(current || createDefaultJournalState());
        });
        return doc.state;
      });
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(queryKey, newState);
    },
  });

  const addEntry = async (mood: Mood, body: string, date?: string): Promise<JournalEntry> => {
    // Generate stable ID before mutateStore to ensure idempotency across CAS retries
    const newEntry: JournalEntry = {
      id: crypto.randomUUID(),
      date: date || todayISO(),
      mood,
      body,
      createdAt: Date.now(),
    };

    await mutation.mutateAsync((current) => addEntryOperation(current, newEntry));
    return newEntry;
  };

  const updateEntry = async (
    id: string,
    patch: Partial<Pick<JournalEntry, "mood" | "body" | "date">>,
  ): Promise<void> => {
    await mutation.mutateAsync((current) => updateEntryOperation(current, id, patch));
  };

  const deleteEntry = async (id: string): Promise<void> => {
    await mutation.mutateAsync((current) => deleteEntryOperation(current, id));
  };

  const entries = query.data?.entries ?? [];

  return {
    entries,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isMutating: mutation.isPending,
    addEntry,
    updateEntry,
    deleteEntry,
    refetch: query.refetch,
  };
}
