import { addDays, todayISO } from "@/lib/date";
import type { MoneyPersistedState } from "../../types";
import type { Txn, TxnInput, SavingsGoal, Account, AccountInput } from "./types";

export function createDefaultMoneyState(): MoneyPersistedState {
  const t = todayISO();
  const d1 = addDays(t, -2);
  const d2 = addDays(t, -5);
  const d3 = addDays(t, -8);
  const d4 = addDays(t, -12);

  return {
    currency: "$",
    accounts: [
      {
        id: "acc-sample-1",
        name: "Main Checking",
        type: "bank",
        initialBalance: 4500,
        currency: "$",
        color: "emerald",
        icon: "landmark",
        createdAt: d4,
      },
      {
        id: "acc-sample-2",
        name: "Visa Platinum",
        type: "card",
        initialBalance: 0,
        currency: "$",
        color: "indigo",
        icon: "credit-card",
        createdAt: d4,
      },
      {
        id: "acc-sample-3",
        name: "Cash Wallet",
        type: "cash",
        initialBalance: 350,
        currency: "$",
        color: "amber",
        icon: "banknote",
        createdAt: d4,
      },
    ],
    transactions: [
      {
        id: "txn-sample-1",
        label: "Client Project Milestone Delivery",
        amount: 3200,
        tag: "Freelance",
        date: t,
        accountId: "acc-sample-1",
      },
      {
        id: "txn-sample-2",
        label: "Organic Groceries & Nutrition",
        amount: -125.5,
        tag: "Food",
        date: d1,
        accountId: "acc-sample-2",
      },
      {
        id: "txn-sample-3",
        label: "Gym Membership & Recovery Club",
        amount: -85,
        tag: "Health",
        date: d2,
        accountId: "acc-sample-2",
      },
      {
        id: "txn-sample-4",
        label: "Cloud Hosting & Dev Tools",
        amount: -45,
        tag: "Tools",
        date: d3,
        accountId: "acc-sample-2",
      },
      {
        id: "txn-sample-5",
        label: "Monthly Investment Allocation",
        amount: -500,
        tag: "Investment",
        date: d4,
        accountId: "acc-sample-1",
      },
    ],
    savings: [
      {
        id: "sav-sample-1",
        name: "Emergency Reserve Fund",
        current: 18500,
        target: 20000,
      },
      {
        id: "sav-sample-2",
        name: "Long-term Index Growth",
        current: 32400,
        target: 50000,
      },
    ],
  };
}

export function normalizeMoneyState(current: unknown): MoneyPersistedState {
  if (!current || typeof current !== "object") {
    return createDefaultMoneyState();
  }
  const s = current as Partial<MoneyPersistedState>;
  return {
    currency: typeof s.currency === "string" ? s.currency : "DA",
    accounts: Array.isArray(s.accounts) ? s.accounts : [],
    transactions: Array.isArray(s.transactions) ? s.transactions : [],
    savings: Array.isArray(s.savings) ? s.savings : [],
  };
}

/**
 * Pure operation to set active currency.
 */
export function setCurrencyOperation(
  current: MoneyPersistedState | null | undefined,
  currency: string,
): MoneyPersistedState {
  const base = normalizeMoneyState(current);
  return {
    ...base,
    currency,
  };
}

/**
 * Pure operation to add an account.
 */
export function addAccountOperation(
  current: MoneyPersistedState | null | undefined,
  account: Account,
): MoneyPersistedState {
  const base = normalizeMoneyState(current);
  return {
    ...base,
    accounts: [...base.accounts, account],
  };
}

/**
 * Pure operation to update an account.
 */
export function updateAccountOperation(
  current: MoneyPersistedState | null | undefined,
  id: string,
  patch: Partial<AccountInput>,
): MoneyPersistedState {
  const base = normalizeMoneyState(current);
  return {
    ...base,
    accounts: base.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}

/**
 * Pure operation to delete an account.
 * Also cleans up or decouples any transactions associated with this account.
 */
export function deleteAccountOperation(
  current: MoneyPersistedState | null | undefined,
  id: string,
): MoneyPersistedState {
  const base = normalizeMoneyState(current);
  return {
    ...base,
    accounts: base.accounts.filter((a) => a.id !== id),
    transactions: base.transactions.map((t) => {
      let updated = t;
      if (t.accountId === id) updated = { ...updated, accountId: undefined };
      if (t.transferAccountId === id) updated = { ...updated, transferAccountId: undefined };
      return updated;
    }),
  };
}

/**
 * Pure operation to add a transaction.
 */
export function addTxnOperation(
  current: MoneyPersistedState | null | undefined,
  txn: Txn,
): MoneyPersistedState {
  const base = normalizeMoneyState(current);
  return {
    ...base,
    transactions: [txn, ...base.transactions],
  };
}

/**
 * Pure operation to update a transaction.
 */
export function updateTxnOperation(
  current: MoneyPersistedState | null | undefined,
  id: string,
  patch: Partial<TxnInput>,
): MoneyPersistedState {
  const base = normalizeMoneyState(current);
  return {
    ...base,
    transactions: base.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  };
}

/**
 * Pure operation to delete a transaction.
 */
export function deleteTxnOperation(
  current: MoneyPersistedState | null | undefined,
  id: string,
): MoneyPersistedState {
  const base = normalizeMoneyState(current);
  return {
    ...base,
    transactions: base.transactions.filter((t) => t.id !== id),
  };
}

/**
 * Pure operation to add a savings goal.
 */
export function addSavingsOperation(
  current: MoneyPersistedState | null | undefined,
  goal: SavingsGoal,
): MoneyPersistedState {
  const base = normalizeMoneyState(current);
  return {
    ...base,
    savings: [...base.savings, goal],
  };
}

/**
 * Pure operation to update a savings goal.
 */
export function updateSavingsOperation(
  current: MoneyPersistedState | null | undefined,
  id: string,
  patch: Partial<Omit<SavingsGoal, "id">>,
): MoneyPersistedState {
  const base = normalizeMoneyState(current);
  return {
    ...base,
    savings: base.savings.map((g) => (g.id === id ? { ...g, ...patch } : g)),
  };
}

/**
 * Pure operation to contribute to a savings goal.
 */
export function addToSavingsOperation(
  current: MoneyPersistedState | null | undefined,
  id: string,
  amount: number,
): MoneyPersistedState {
  const base = normalizeMoneyState(current);
  return {
    ...base,
    savings: base.savings.map((g) =>
      g.id === id ? { ...g, current: Math.max(0, g.current + amount) } : g,
    ),
  };
}

/**
 * Pure operation to delete a savings goal.
 */
export function deleteSavingsOperation(
  current: MoneyPersistedState | null | undefined,
  id: string,
): MoneyPersistedState {
  const base = normalizeMoneyState(current);
  return {
    ...base,
    savings: base.savings.filter((g) => g.id !== id),
  };
}
