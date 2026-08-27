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
  createDefaultMoneyState,
  setCurrencyOperation,
  addTxnOperation,
  updateTxnOperation,
  deleteTxnOperation,
  addSavingsOperation,
  updateSavingsOperation,
  addToSavingsOperation,
  deleteSavingsOperation,
} from "./operations";
import type { Txn, TxnInput, SavingsGoal } from "./types";

export function useMoneyData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, "lifeos-money");
  const enqueue = useSerializedMutations();

  const query = useQuery({
    queryKey,
    enabled: !!adapter,
    queryFn: async () => {
      if (!adapter) return createDefaultMoneyState();
      const doc = await adapter.getStore("lifeos-money");
      return doc ? doc.state : createDefaultMoneyState();
    },
  });

  const mutation = useMutation({
    mutationFn: async (updater: (state: ReturnType<typeof createDefaultMoneyState>) => ReturnType<typeof createDefaultMoneyState>) => {
      if (!adapter) {
        throw new Error("No active data adapter available for Money mutation.");
      }
      return enqueue(async () => {
        const doc = await adapter.mutateStore("lifeos-money", (current) => {
          return updater(current || createDefaultMoneyState());
        });
        return doc.state;
      });
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(queryKey, newState);
    },
  });

  const setCurrency = async (currency: string): Promise<void> => {
    await mutation.mutateAsync((current) => setCurrencyOperation(current, currency));
  };

  const addTxn = async (input: TxnInput): Promise<Txn> => {
    const newTxn: Txn = {
      id: crypto.randomUUID(),
      ...input,
    };
    await mutation.mutateAsync((current) => addTxnOperation(current, newTxn));
    return newTxn;
  };

  const updateTxn = async (id: string, patch: Partial<TxnInput>): Promise<void> => {
    await mutation.mutateAsync((current) => updateTxnOperation(current, id, patch));
  };

  const deleteTxn = async (id: string): Promise<void> => {
    await mutation.mutateAsync((current) => deleteTxnOperation(current, id));
  };

  const addSavings = async (name: string, target: number): Promise<SavingsGoal> => {
    const newSavings: SavingsGoal = {
      id: crypto.randomUUID(),
      name,
      target,
      current: 0,
    };
    await mutation.mutateAsync((current) => addSavingsOperation(current, newSavings));
    return newSavings;
  };

  const updateSavings = async (
    id: string,
    patch: Partial<Omit<SavingsGoal, "id">>,
  ): Promise<void> => {
    await mutation.mutateAsync((current) => updateSavingsOperation(current, id, patch));
  };

  const addToSavings = async (id: string, amount: number): Promise<void> => {
    await mutation.mutateAsync((current) => addToSavingsOperation(current, id, amount));
  };

  const deleteSavings = async (id: string): Promise<void> => {
    await mutation.mutateAsync((current) => deleteSavingsOperation(current, id));
  };

  const currency = query.data?.currency ?? "DA";
  const transactions = query.data?.transactions ?? [];
  const savings = query.data?.savings ?? [];

  return {
    currency,
    transactions,
    savings,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isMutating: mutation.isPending,
    setCurrency,
    addTxn,
    updateTxn,
    deleteTxn,
    addSavings,
    updateSavings,
    addToSavings,
    deleteSavings,
    refetch: query.refetch,
  };
}
