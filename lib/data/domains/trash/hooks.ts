"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataAdapter, useDataEdition, useDataUserId } from "../../query/provider";
import { queryKeys } from "../../query/keys";
import { useSerializedMutations } from "../../query/mutation-queue";
import type { TrashPersistedState } from "../../types";
import {
  createDefaultTrashState,
  normalizeTrashState,
  moveToTrashOperation,
  deletePermanentlyOperation,
  emptyTrashOperation,
  type TrashItem,
  type TrashItemInput,
} from "./operations";
import {
  restoreEntityFromTrash,
  restoreDefaultProgramsService,
} from "./service";

const STORE_KEY = "lifeos-trash" as const;

export function useTrashData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, STORE_KEY);
  const enqueue = useSerializedMutations();

  const { data, isLoading, error } = useQuery<TrashPersistedState, Error>({
    queryKey,
    queryFn: async () => {
      if (!adapter) {
        return createDefaultTrashState();
      }
      const doc = await adapter.getStore(STORE_KEY);
      return normalizeTrashState(doc?.state);
    },
    enabled: !!adapter,
  });

  const mutation = useMutation<
    TrashPersistedState,
    Error,
    (current: TrashPersistedState) => TrashPersistedState
  >({
    mutationFn: async (updater) => {
      if (!adapter) {
        throw new Error("No data adapter available for trash mutation.");
      }
      return enqueue(async () => {
        const res = await adapter.mutateStore(STORE_KEY, (prev) => {
          const base = normalizeTrashState(prev);
          return updater(base);
        });
        return normalizeTrashState(res.state);
      });
    },
    onSuccess: (nextState) => {
      queryClient.setQueryData(queryKey, nextState);
    },
  });

  const state = data ?? createDefaultTrashState();

  const moveToTrash = useCallback(
    async (item: TrashItemInput): Promise<TrashItem> => {
      const entityId = (item.itemData && typeof item.itemData === "object" && "id" in item.itemData)
        ? String((item.itemData as { id: unknown }).id)
        : crypto.randomUUID();
      const stableId = item.id || `trash-${item.itemType}-${entityId}`;
      const fullItem: TrashItem = {
        id: stableId,
        itemType: item.itemType,
        title: item.title,
        description: item.description,
        itemData: item.itemData,
        deletedAt: item.deletedAt || new Date().toISOString(),
        originalStoreKey: item.originalStoreKey,
      };

      await mutation.mutateAsync((current) => moveToTrashOperation(current, fullItem));
      return fullItem;
    },
    [mutation],
  );

  const restoreItem = useCallback(
    async (id: string): Promise<void> => {
      if (!adapter) {
        throw new Error("No data adapter available for restoreItem.");
      }
      await restoreEntityFromTrash(adapter, id);
      // Invalidate destination queries and trash query
      await queryClient.invalidateQueries();
    },
    [adapter, queryClient],
  );

  const deletePermanently = useCallback(
    async (id: string): Promise<void> => {
      await mutation.mutateAsync((current) => deletePermanentlyOperation(current, id));
    },
    [mutation],
  );

  const emptyTrash = useCallback(
    async (): Promise<void> => {
      await mutation.mutateAsync(() => emptyTrashOperation());
    },
    [mutation],
  );

  const restoreDefaultPrograms = useCallback(
    async (): Promise<void> => {
      if (!adapter) {
        throw new Error("No data adapter available for restoreDefaultPrograms.");
      }
      await restoreDefaultProgramsService(adapter);
      await queryClient.invalidateQueries();
    },
    [adapter, queryClient],
  );

  return {
    items: state.items,
    isLoading,
    error,
    edition,
    moveToTrash,
    restoreItem,
    deletePermanently,
    emptyTrash,
    restoreDefaultPrograms,
  };
}
