import type { Txn, MonthAgg, Account } from "./types";

export const fmtMoney = (n: number, currency: string = "DA") => {
  if (currency === "DA") return `${n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("en-US")} DA`;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n).replace("-", "−");
  } catch {
    return `${n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("en-US")} ${currency}`;
  }
};

/**
 * Calculates the real-time ledger balance for a single account:
 * initialBalance + non-transfer incomes/expenses + transfers in - transfers out
 */
export const accountBalance = (account: Account, txns: Txn[] = []): number => {
  let bal = account.initialBalance ?? 0;
  for (const t of txns) {
    if (!t) continue;
    const isSource = t.accountId === account.id;
    const isTarget = t.transferAccountId === account.id;

    if (t.transferAccountId) {
      // Transfer transaction
      const transferAmt = Math.abs(t.amount);
      if (isSource) bal -= transferAmt;
      if (isTarget) bal += transferAmt;
    } else {
      // Regular transaction
      if (isSource) bal += t.amount;
    }
  }
  return bal;
};

/**
 * Computes aggregate net worth across all active accounts plus any unassigned transactions.
 * If accounts list is empty, returns raw sum of all transactions.
 */
export const totalNetWorth = (accounts: Account[] = [], txns: Txn[] = []): number => {
  if (!accounts || accounts.length === 0) {
    return txns.reduce((s, x) => s + (x?.amount || 0), 0);
  }
  const accountIds = new Set(accounts.map((a) => a.id));
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  let total = activeAccounts.reduce((s, a) => s + accountBalance(a, txns), 0);

  // Add unassigned non-transfer transactions
  for (const t of txns) {
    if (!t || t.transferAccountId) continue;
    if (!t.accountId || !accountIds.has(t.accountId)) {
      total += t.amount;
    }
  }
  return total;
};

export const balance = (txns: Txn[], accounts?: Account[]) => {
  if (accounts && accounts.length > 0) {
    return totalNetWorth(accounts, txns);
  }
  return txns.reduce((s, x) => s + (x?.amount || 0), 0);
};

/** month key YYYY-MM */
const monthKey = (iso: string) => iso.slice(0, 7);

export const monthlyAgg = (
  txns: Txn[],
  nMonths = 6,
  selectedAccountId?: string,
): MonthAgg[] => {
  const now = new Date();
  const months: MonthAgg[] = [];
  for (let i = nMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`;
    months.push({
      key,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      income: 0,
      expense: 0,
    });
  }
  const map = new Map(months.map((m) => [m.key, m]));
  (txns || []).forEach((x) => {
    if (!x || x.label === "Opening balance") return;
    const m = map.get(monthKey(x.date));
    if (!m) return;

    if (selectedAccountId) {
      const isSource = x.accountId === selectedAccountId;
      const isTarget = x.transferAccountId === selectedAccountId;
      if (!isSource && !isTarget) return;

      if (x.transferAccountId) {
        const amt = Math.abs(x.amount);
        if (isSource) m.expense += amt;
        if (isTarget) m.income += amt;
      } else {
        if (x.amount >= 0) m.income += x.amount;
        else m.expense += -x.amount;
      }
    } else {
      // All accounts view - skip internal transfers from income/expense totals
      if (x.transferAccountId) return;
      if (x.amount >= 0) m.income += x.amount;
      else m.expense += -x.amount;
    }
  });
  return months;
};

/** Net this month + % change vs previous month. */
export const monthNet = (txns: Txn[], selectedAccountId?: string) => {
  const agg = monthlyAgg(txns, 2, selectedAccountId);
  const [prev, cur] = agg;
  const net = cur.income - cur.expense;
  const prevNet = prev.income - prev.expense;
  const trendPct = prevNet !== 0 ? Math.round(((net - prevNet) / Math.abs(prevNet)) * 100) : null;
  return { net, trendPct };
};

/** Runway = balance ÷ average monthly expense over the last 3 full-ish months. */
export const runwayMonths = (txns: Txn[], accounts?: Account[], selectedAccountId?: string) => {
  const agg = monthlyAgg(txns, 4, selectedAccountId).slice(0, 3); // exclude current partial month
  const avgExpense = agg.reduce((s, m) => s + m.expense, 0) / (agg.length || 1);
  if (avgExpense <= 0) return null;
  const currentBal = selectedAccountId && accounts
    ? accounts.find((a) => a.id === selectedAccountId)
      ? accountBalance(accounts.find((a) => a.id === selectedAccountId)!, txns)
      : 0
    : balance(txns, accounts);
  return Math.round((currentBal / avgExpense) * 10) / 10;
};
