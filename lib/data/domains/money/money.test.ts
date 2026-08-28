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
  normalizeMoneyState,
  setCurrencyOperation,
  addAccountOperation,
  updateAccountOperation,
  deleteAccountOperation,
  addTxnOperation,
  updateTxnOperation,
  deleteTxnOperation,
  addSavingsOperation,
  updateSavingsOperation,
  addToSavingsOperation,
  deleteSavingsOperation,
} from "./operations";
import {
  accountBalance,
  totalNetWorth,
  balance,
  monthlyAgg,
  monthNet,
  runwayMonths,
} from "./utils";
import { useMoneyData } from "./hooks";
import type { Txn, SavingsGoal, Account } from "./types";
import type { MoneyPersistedState } from "../../types";

describe("Money Domain — Pure Operations & Ledger Math", () => {
  it("returns default state with currency, accounts, starter transactions & savings", () => {
    const state = createDefaultMoneyState();
    expect(state.currency).toBe("$");
    expect(state.accounts.length).toBeGreaterThan(0);
    expect(state.transactions.length).toBeGreaterThan(0);
    expect(state.savings.length).toBeGreaterThan(0);
  });

  it("normalizes legacy state by populating empty accounts array", () => {
    const legacy = { currency: "USD", transactions: [], savings: [] };
    const normalized = normalizeMoneyState(legacy);
    expect(normalized.accounts).toEqual([]);
    expect(normalized.currency).toBe("USD");
  });

  it("manages accounts (add, update, delete)", () => {
    const base: MoneyPersistedState = { currency: "$", accounts: [], transactions: [], savings: [] };
    const acc1: Account = {
      id: "acc-1",
      name: "Main Checking",
      type: "bank",
      initialBalance: 1000,
      createdAt: "2026-08-01",
    };

    const s1 = addAccountOperation(base, acc1);
    expect(s1.accounts).toEqual([acc1]);

    const s2 = updateAccountOperation(s1, "acc-1", { name: "Primary Checking", initialBalance: 1200 });
    expect(s2.accounts[0].name).toBe("Primary Checking");
    expect(s2.accounts[0].initialBalance).toBe(1200);

    const s3 = deleteAccountOperation(s2, "acc-1");
    expect(s3.accounts).toHaveLength(0);
  });

  it("calculates real-time ledger account balance across incomes, expenses, and transfers", () => {
    const checking: Account = {
      id: "acc-chk",
      name: "Checking",
      type: "bank",
      initialBalance: 1000,
      createdAt: "2026-08-01",
    };
    const savingsAcc: Account = {
      id: "acc-sav",
      name: "Savings Vault",
      type: "savings",
      initialBalance: 500,
      createdAt: "2026-08-01",
    };

    const txns: Txn[] = [
      // Income into checking
      { id: "tx1", label: "Salary", amount: 2000, tag: "Salary", date: "2026-08-02", accountId: "acc-chk" },
      // Expense from checking
      { id: "tx2", label: "Groceries", amount: -150, tag: "Food", date: "2026-08-03", accountId: "acc-chk" },
      // Transfer from checking to savings
      {
        id: "tx3",
        label: "Save for Vacation",
        amount: 400,
        tag: "Transfer",
        date: "2026-08-04",
        accountId: "acc-chk",
        transferAccountId: "acc-sav",
      },
    ];

    // Checking: 1000 (init) + 2000 (inc) - 150 (exp) - 400 (xfer out) = 2450
    expect(accountBalance(checking, txns)).toBe(2450);

    // Savings: 500 (init) + 400 (xfer in) = 900
    expect(accountBalance(savingsAcc, txns)).toBe(900);

    // Total net worth: 2450 + 900 = 3350
    expect(totalNetWorth([checking, savingsAcc], txns)).toBe(3350);
    expect(balance(txns, [checking, savingsAcc])).toBe(3350);
  });

  it("handles unassigned transactions in total net worth calculation", () => {
    const acc: Account = { id: "a1", name: "Bank", type: "bank", initialBalance: 100, createdAt: "2026-08-01" };
    const txns: Txn[] = [
      { id: "t1", label: "Cash in pocket", amount: 50, tag: "Other", date: "2026-08-01" }, // unassigned
    ];
    expect(totalNetWorth([acc], txns)).toBe(150);
  });

  it("calculates monthly aggregate properly filtering transfers", () => {
    const txns: Txn[] = [
      { id: "t1", label: "Income", amount: 1000, tag: "Salary", date: "2026-08-10", accountId: "a1" },
      { id: "t2", label: "Groceries", amount: -200, tag: "Food", date: "2026-08-11", accountId: "a1" },
      { id: "t3", label: "Transfer", amount: 300, tag: "Transfer", date: "2026-08-12", accountId: "a1", transferAccountId: "a2" },
    ];

    // Global view excludes internal transfer from income/expense
    const globalAgg = monthlyAgg(txns, 1);
    expect(globalAgg[0].income).toBe(1000);
    expect(globalAgg[0].expense).toBe(200);

    // Account a1 view includes transfer out as expense/outflow
    const a1Agg = monthlyAgg(txns, 1, "a1");
    expect(a1Agg[0].income).toBe(1000);
    expect(a1Agg[0].expense).toBe(500); // 200 expense + 300 transfer out

    // Account a2 view includes transfer in as income/inflow
    const a2Agg = monthlyAgg(txns, 1, "a2");
    expect(a2Agg[0].income).toBe(300);
    expect(a2Agg[0].expense).toBe(0);
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
      version: 4,
      state: { currency: "DA", accounts: [], transactions: [], savings: [] },
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

  it("reads and creates accounts and transactions with LocalAdapter", async () => {
    const { result } = renderHook(() => useMoneyData(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.accounts).toHaveLength(0);
    expect(result.current.transactions).toHaveLength(0);

    let acc: Account | undefined;
    await act(async () => {
      acc = await result.current.addAccount({
        name: "Main Bank",
        type: "bank",
        initialBalance: 2500,
        currency: "USD",
        color: "emerald",
        icon: "landmark",
      });
    });

    expect(acc?.id).toBeDefined();
    await waitFor(() => expect(result.current.accounts).toHaveLength(1));
    expect(result.current.accounts[0].name).toBe("Main Bank");

    let txn: Txn | undefined;
    await act(async () => {
      txn = await result.current.addTxn({
        label: "Freelance Client",
        amount: 800,
        tag: "Freelance",
        date: "2026-08-25",
        accountId: acc!.id,
      });
    });

    expect(txn?.id).toBeDefined();
    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    expect(result.current.transactions[0].accountId).toBe(acc!.id);

    // Verify stored in Dexie database
    const doc = await adapter.getStore("lifeos-money");
    expect(doc?.state.accounts).toHaveLength(1);
    expect(doc?.state.transactions).toHaveLength(1);
  });

  it("executes account-to-account transfers cleanly", async () => {
    const { result } = renderHook(() => useMoneyData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let a1: Account | undefined;
    let a2: Account | undefined;
    await act(async () => {
      a1 = await result.current.addAccount({ name: "Checking", type: "bank", initialBalance: 1000 });
      a2 = await result.current.addAccount({ name: "Savings", type: "savings", initialBalance: 200 });
    });

    await waitFor(() => expect(result.current.accounts).toHaveLength(2));

    await act(async () => {
      await result.current.transferMoney(a1!.id, a2!.id, 300, "Monthly Savings");
    });

    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    const xfer = result.current.transactions[0];
    expect(xfer.tag).toBe("Transfer");
    expect(xfer.accountId).toBe(a1!.id);
    expect(xfer.transferAccountId).toBe(a2!.id);
    expect(xfer.amount).toBe(300);

    // Check balances
    expect(accountBalance(result.current.accounts.find((a) => a.id === a1!.id)!, result.current.transactions)).toBe(700);
    expect(accountBalance(result.current.accounts.find((a) => a.id === a2!.id)!, result.current.transactions)).toBe(500);
  });

  it("persists accounts across adapter reloads", async () => {
    const dbName = `money-reload-${Date.now()}`;
    const adapter1 = new LocalAdapter({ databaseName: dbName });
    await adapter1.initialize();

    await adapter1.mutateStore("lifeos-money", () => ({
      currency: "USD",
      accounts: [{ id: "acc-p1", name: "Chase", type: "bank", initialBalance: 5000, createdAt: "2026-08-01" }],
      transactions: [{ id: "tx-p1", label: "Income", amount: 500, tag: "Salary", date: "2026-08-23", accountId: "acc-p1" }],
      savings: [{ id: "sg-p1", name: "House", current: 10000, target: 50000 }],
    }));
    await adapter1.close();

    const adapter2 = new LocalAdapter({ databaseName: dbName });
    await adapter2.initialize();
    const doc = await adapter2.getStore("lifeos-money");
    expect(doc?.state.currency).toBe("USD");
    expect(doc?.state.accounts).toHaveLength(1);
    expect(doc?.state.accounts[0].name).toBe("Chase");
    expect(doc?.state.transactions).toHaveLength(1);

    await adapter2.close();
  });
});
