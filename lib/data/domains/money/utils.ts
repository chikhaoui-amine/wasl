import type { Txn, MonthAgg } from "./types";

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

export const balance = (txns: Txn[]) => txns.reduce((s, x) => s + x.amount, 0);

/** month key YYYY-MM */
const monthKey = (iso: string) => iso.slice(0, 7);

export const monthlyAgg = (txns: Txn[], nMonths = 6): MonthAgg[] => {
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
    if (x.amount >= 0) m.income += x.amount;
    else m.expense += -x.amount;
  });
  return months;
};

/** Net this month + % change vs previous month. */
export const monthNet = (txns: Txn[]) => {
  const agg = monthlyAgg(txns, 2);
  const [prev, cur] = agg;
  const net = cur.income - cur.expense;
  const prevNet = prev.income - prev.expense;
  const trendPct = prevNet !== 0 ? Math.round(((net - prevNet) / Math.abs(prevNet)) * 100) : null;
  return { net, trendPct };
};

/** Runway = balance ÷ average monthly expense over the last 3 full-ish months. */
export const runwayMonths = (txns: Txn[]) => {
  const agg = monthlyAgg(txns, 4).slice(0, 3); // exclude current partial month
  const avgExpense = agg.reduce((s, m) => s + m.expense, 0) / (agg.length || 1);
  if (avgExpense <= 0) return null;
  return Math.round((balance(txns) / avgExpense) * 10) / 10;
};
