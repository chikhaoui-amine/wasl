"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataAdapter, useDataEdition, useDataUserId } from "../../query/provider";
import { queryKeys } from "../../query/keys";
import { useSerializedMutations } from "../../query/mutation-queue";
import type { BlocksPersistedState } from "../../types";
import {
  createDefaultBlocksState,
  normalizeBlocksState,
  addBlockOperation,
  updateBlockOperation,
  deleteBlockOperation,
  setViewOperation,
  setAnchorOperation,
  type Block,
  type BlockInput,
} from "./operations";

const STORE_KEY = "lifeos-blocks" as const;

export function useBlocksData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, STORE_KEY);
  const enqueue = useSerializedMutations();


  const { data, isLoading, error } = useQuery<BlocksPersistedState, Error>({
    queryKey,
    queryFn: async () => {
      if (!adapter) {
        return createDefaultBlocksState();
      }
      const doc = await adapter.getStore(STORE_KEY);
      return normalizeBlocksState(doc?.state);
    },
    enabled: !!adapter,
  });

  const mutation = useMutation<
    BlocksPersistedState,
    Error,
    (current: BlocksPersistedState) => BlocksPersistedState
  >({
    mutationFn: async (updater) => {
      if (!adapter) {
        throw new Error("No data adapter available for blocks mutation.");
      }
      return enqueue(async () => {
          const res = await adapter.mutateStore(STORE_KEY, (prev) => {
            const base = normalizeBlocksState(prev);
            return updater(base);
          });
          return normalizeBlocksState(res.state);
      });
    },
    onSuccess: (nextState) => {
      queryClient.setQueryData(queryKey, nextState);
    },
  });

  const state = data ?? createDefaultBlocksState();

  const addBlock = useCallback(
    async (input: BlockInput): Promise<Block> => {
      const pregeneratedId = crypto.randomUUID();
      const newBlock: Block = {
        id: pregeneratedId,
        ...input,
      };

      await mutation.mutateAsync((current) => addBlockOperation(current, newBlock));
      return newBlock;
    },
    [mutation],
  );

  const updateBlock = useCallback(
    async (id: string, patch: Partial<BlockInput>): Promise<void> => {
      await mutation.mutateAsync((current) => updateBlockOperation(current, id, patch));
    },
    [mutation],
  );

  const deleteBlock = useCallback(
    async (id: string): Promise<void> => {
      await mutation.mutateAsync((current) => deleteBlockOperation(current, id));
    },
    [mutation],
  );

  const setView = useCallback(
    async (view: "week" | "day"): Promise<void> => {
      await mutation.mutateAsync((current) => setViewOperation(current, view));
    },
    [mutation],
  );

  const setAnchor = useCallback(
    async (anchor: string): Promise<void> => {
      await mutation.mutateAsync((current) => setAnchorOperation(current, anchor));
    },
    [mutation],
  );

  return {
    blocks: state.blocks,
    view: state.view ?? "week",
    anchor: state.anchor,
    isLoading,
    error,
    edition,
    addBlock,
    updateBlock,
    deleteBlock,
    setView,
    setAnchor,
  };
}
