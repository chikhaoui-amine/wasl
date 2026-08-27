export interface Txn {
  id: string;
  label: string;
  amount: number; // + income, − expense
  tag: string;
  date: string; // ISO
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

export const INCOME_TAGS = ["Freelance", "Tijari", "Slotly", "Salary", "Investment", "Other"] as const;
export const EXPENSE_TAGS = ["Living", "Food", "Household", "Tools", "Transport", "Health", "Personal", "Other"] as const;
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
  "Other",
];
