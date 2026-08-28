export type AccountType = "bank" | "card" | "cash" | "savings" | "investment" | "wallet";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currency?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  isArchived?: boolean;
}

export type AccountInput = Omit<Account, "id" | "createdAt">;

export interface Txn {
  id: string;
  label: string;
  amount: number; // + income, − expense
  tag: string;
  date: string; // ISO
  accountId?: string;
  transferAccountId?: string;
}

export type TxnInput = Omit<Txn, "id">;

export interface SavingsGoal {
  id: string;
  name: string;
  current: number;
  target: number;
}

export interface MonthAgg {
  key: string;
  label: string;
  income: number;
  expense: number;
}

export const ACCOUNT_TYPES: readonly { type: AccountType; label: string }[] = [
  { type: "bank", label: "Bank Account" },
  { type: "card", label: "Credit / Debit Card" },
  { type: "cash", label: "Cash / Wallet" },
  { type: "savings", label: "Savings / Vault" },
  { type: "investment", label: "Investment / Crypto" },
  { type: "wallet", label: "Digital Wallet" },
];

export const ACCOUNT_COLORS = [
  "emerald",
  "blue",
  "indigo",
  "purple",
  "amber",
  "rose",
  "slate",
] as const;

export const INCOME_TAGS = ["Freelance", "Tijari", "Slotly", "Salary", "Investment", "Transfer", "Other"] as const;
export const EXPENSE_TAGS = ["Living", "Food", "Household", "Tools", "Transport", "Health", "Personal", "Transfer", "Other"] as const;
export const TXN_TAGS = [
  "Living",
  "Food",
  "Household",
  "Tools",
  "Transport",
  "Health",
  "Personal",
  "Freelance",
  "Tijari",
  "Slotly",
  "Salary",
  "Investment",
  "Transfer",
  "Other",
];
