// @vitest-environment jsdom
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

import { LocalAdapter } from "@/lib/data/adapters/local/local-adapter";
import { DataProvider, createMemoryQueryClient } from "@/lib/data/query/provider";
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
import { useMoneyData } from "./hooks";
import type { Txn, SavingsGoal } from "./types";
import type { MoneyPersistedState } from "../../types";

describe("Money Domain — Pure Operations", () => {
  it("returns default state with currency and starter transactions & savings", () => {
    const state = createDefaultMoneyState();
    expect(state.currency).toBe("$");
    expect(state.transactions.length).toBeGreaterThan(0);
    expect(state.savings.length).toBeGreaterThan(0);
  });

  it("sets currency cleanly", () => {
    const s1 = createDefaultMoneyState();
    const s2 = setCurrencyOperation(s1, "USD");
    expect(s2.currency).toBe("USD");
  });

  it("adds transactions and maintains ordering", () => {
    const base: MoneyPersistedState = { currency: "$", transactions: [], savings: [] };
    const t1: Txn = { id: "tx1", label: "Salary", amount: 3000, tag: "Salary", date: "2026-08-01" };
    const t2: Txn = { id: "tx2", label: "Groceries", amount: -150, tag: "Food", date: "2026-08-02" };

    const s1 = addTxnOperation(base, t1);
    const s2 = addTxnOperation(s1, t2);

    expect(s2.transactions).toEqual([t2, t1]);
  });

  it("updates and deletes transactions", () => {
    const t1: Txn = { id: "tx1", label: "Salary", amount: 3000, tag: "Salary", date: "2026-08-01" };
    const s1 = addTxnOperation({ currency: "$", transactions: [], savings: [] }, t1);

    const s2 = updateTxnOperation(s1, "tx1", { amount: 3500, label: "Raised Salary" });
    expect(s2.transactions[0].amount).toBe(3500);
    expect(s2.transactions[0].label).toBe("Raised Salary");

    const s3 = deleteTxnOperation(s2, "tx1");
    expect(s3.transactions).toHaveLength(0);
  });

  it("manages savings goals (add, update, contribute, delete)", () => {
    const base: MoneyPersistedState = { currency: "$", transactions: [], savings: [] };
    const goal: SavingsGoal = { id: "sg1", name: "Emergency Fund", target: 10000, current: 0 };

    const s1 = addSavingsOperation(base, goal);
    expect(s1.savings).toEqual([goal]);

    const s2 = addToSavingsOperation(s1, "sg1", 2500);
    expect(s2.savings[0].current).toBe(2500);

    const s3 = updateSavingsOperation(s2, "sg1", { name: "Big Emergency Fund", target: 15000 });
    expect(s3.savings[0].name).toBe("Big Emergency Fund");
    expect(s3.savings[0].target).toBe(15000);
    expect(s3.savings[0].current).toBe(2500);

    const s4 = deleteSavingsOperation(s3, "sg1");
    expect(s4.savings).toHaveLength(0);
  });
});

describe("Money Domain — Adapter Integration & Parity", () => {
  let adapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(async () => {
    testLocalStorage.clear();
    adapter = new LocalAdapter({ databaseName: `money-test-${Date.now()}-${Math.random()}` });
    await adapter.initialize();
    await adapter.putStore({
      store: "lifeos-money",
      version: 3,
      state: { currency: "DA", transactions: [], savings: [] },
      updatedAt: new Date().toISOString(),
      revision: 1,
    });
    queryClient = createMemoryQueryClient();
  });

  afterEach(async () => {
    await adapter.close();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      DataProvider,
      { adapter, queryClient, edition: "local" },
      children,
    );
  }

  it("reads and creates transactions with LocalAdapter", async () => {
    const { result } = renderHook(() => useMoneyData(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.transactions).toHaveLength(0);
    expect(result.current.currency).toBe("DA");

    let addedTxn: Txn | undefined;
    await act(async () => {
      addedTxn = await result.current.addTxn({
        label: "Freelance Landing Page",
        amount: 1200,
        tag: "Freelance",
        date: "2026-08-23",
      });
    });

    expect(addedTxn?.id).toBeDefined();
    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    expect(result.current.transactions[0].label).toBe("Freelance Landing Page");

    // Verify stored in LocalAdapter Dexie database
    const doc = await adapter.getStore("lifeos-money");
    expect(doc?.state.transactions).toHaveLength(1);
    expect(doc?.state.transactions[0].id).toBe(addedTxn?.id);
  });

  it("updates currency, transactions, and savings goals", async () => {
    const { result } = renderHook(() => useMoneyData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setCurrency("EUR");
    });
    await waitFor(() => expect(result.current.currency).toBe("EUR"));

    let goal: SavingsGoal | undefined;
    await act(async () => {
      goal = await result.current.addSavings("Laptop Fund", 2000);
    });
    expect(goal?.id).toBeDefined();
    await waitFor(() => expect(result.current.savings).toHaveLength(1));

    await act(async () => {
      await result.current.addToSavings(goal!.id, 500);
    });
    await waitFor(() => expect(result.current.savings[0].current).toBe(500));
  });

  it("persists transactions and savings across adapter reloads", async () => {
    const dbName = `money-reload-${Date.now()}`;
    const adapter1 = new LocalAdapter({ databaseName: dbName });
    await adapter1.initialize();

    await adapter1.mutateStore("lifeos-money", () => ({
      currency: "USD",
      transactions: [{ id: "tx-p1", label: "Income", amount: 500, tag: "Salary", date: "2026-08-23" }],
      savings: [{ id: "sg-p1", name: "House", current: 10000, target: 50000 }],
    }));
    await adapter1.close();

    const adapter2 = new LocalAdapter({ databaseName: dbName });
    await adapter2.initialize();
    const doc = await adapter2.getStore("lifeos-money");
    expect(doc?.state.currency).toBe("USD");
    expect(doc?.state.transactions).toHaveLength(1);
    expect(doc?.state.savings).toHaveLength(1);

    await adapter2.close();
  });

});
