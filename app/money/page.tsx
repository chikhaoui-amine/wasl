"use client";

import { useState } from "react";
import { Pencil, PiggyBank, Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import {
  useMoneyData,
  fmtMoney,
  balance,
  monthlyAgg,
  monthNet,
  runwayMonths,
  type Txn,
  type SavingsGoal,
} from "@/lib/data/domains/money";
import { Card, ProgressBar, SectionTitle } from "@/components/ui/primitives";
import { StatTile } from "@/components/ui/charts";
import { TxnForm } from "@/components/forms/TxnForm";
import { Modal, Field, FormFooter, inputCls } from "@/components/ui/Modal";
import { Hydrate } from "@/lib/hydration";
import { relLabel } from "@/lib/date";

const ALL_CURRENCIES = (
  typeof Intl !== "undefined" && Intl.supportedValuesOf
    ? Intl.supportedValuesOf("currency")
    : ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"]
).filter((c) => c !== "DZD");

function getFlagEmoji(currencyCode: string) {
  if (currencyCode.startsWith("X")) return "🌍";
  const countryCode = currencyCode.substring(0, 2);
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function getCurrencyLabel(currency: string) {
  const flag = getFlagEmoji(currency);
  try {
    const parts = new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "symbol" }).formatToParts(0);
    const symbol = parts.find((x) => x.type === "currency")?.value;
    const suffix = symbol && symbol !== currency ? ` (${symbol})` : "";
    return `${flag} ${currency}${suffix}`;
  } catch {
    return `${flag} ${currency}`;
  }
}

export default function MoneyPage() {
  const { transactions, savings, currency, setCurrency } = useMoneyData();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Txn | undefined>();
  const [savingsModal, setSavingsModal] = useState<SavingsGoal | "new" | undefined>();

  const bal = balance(transactions);
  const { net, trendPct } = monthNet(transactions);
  const runway = runwayMonths(transactions);
  const months = monthlyAgg(transactions, 6);
  const chartMax = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1);
  const recent = [...transactions]
    .filter((x) => x.label !== "Opening balance")
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 8);

  return (
    <Hydrate>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-muted">Every venture and your personal life, one clear picture.</p>
          <div className="flex items-center gap-3">
            <select
              className="bg-transparent text-[13px] font-medium text-muted outline-none cursor-pointer"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              title="Currency"
            >
              <option value="DA">DZD (DA)</option>
              {ALL_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {getCurrencyLabel(c)}
                </option>
              ))}
            </select>
            <button
              onClick={() => setCreating(true)}
              className="btn-hero flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
            >
              <Plus className="h-4 w-4" /> Log transaction
            </button>
          </div>
        </div>

        {/* Hero stats — all computed from your transactions */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatTile
            label="Runway"
            value={runway ?? "—"}
            unit={runway ? "months" : undefined}
            icon={<Wallet className="h-4 w-4" />}
            hint="balance ÷ avg monthly spend"
            hero
          />
          <StatTile
            label="Net this month"
            value={fmtMoney(net, currency)}
            icon={net >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            accent={net >= 0 ? "var(--success)" : "var(--danger)"}
            delta={trendPct}
            hint={trendPct !== null ? "vs last month" : "first month"}
          />
          <StatTile label="Balance" value={fmtMoney(bal, currency)} hint="all transactions" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Income vs expense */}
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-faint">
                Income vs expenses · 6 months
              </h2>
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} /> Income
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="hatch h-2.5 w-2.5 rounded-[3px]" style={{ color: "var(--muted)" }} /> Expenses
                </span>
              </div>
            </div>

            <div className="flex items-end gap-2">
              {months.map((m) => (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end justify-center gap-1">
                    <div
                      className="w-1/3 rounded-t-[6px] rounded-b-[3px] transition-[filter] hover:brightness-110"
                      style={{
                        height: `${(m.income / chartMax) * 100}%`,
                        background: "var(--accent)",
                        boxShadow: "0 0 12px -4px var(--accent)",
                      }}
                      title={`${m.label} income: ${fmtMoney(m.income, currency)}`}
                    />
                    <div
                      className="hatch w-1/3 rounded-t-[6px] rounded-b-[3px] opacity-70 transition-opacity hover:opacity-100"
                      style={{ height: `${(m.expense / chartMax) * 100}%`, color: "var(--muted)" }}
                      title={`${m.label} expenses: ${fmtMoney(m.expense, currency)}`}
                    />
                  </div>
                  <span className="text-[11px] text-faint">{m.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Savings goals */}
          <Card className="p-5">
            <SectionTitle
              action={
                <button onClick={() => setSavingsModal("new")} className="text-[12px] font-medium text-accent hover:opacity-80">
                  + goal
                </button>
              }
            >
              Savings goals
            </SectionTitle>
            {savings.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-faint">No savings goals yet.</p>
            ) : (
              <div className="space-y-4">
                {savings.map((g) => {
                  const pct = Math.min(100, Math.round((g.current / g.target) * 100));
                  return (
                    <button key={g.id} onClick={() => setSavingsModal(g)} className="block w-full text-left">
                      <div className="mb-1.5 flex items-center justify-between text-[13px]">
                        <span className="font-medium text-text">{g.name}</span>
                        <span className="tabular text-faint">{pct}%</span>
                      </div>
                      <ProgressBar value={pct} />
                      <div className="tabular mt-1 text-[11px] text-faint">
                        {fmtMoney(g.current, currency)} / {fmtMoney(g.target, currency)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Transactions */}
        <Card className="p-5">
          <SectionTitle>Recent transactions</SectionTitle>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-faint">Nothing logged yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((x) => (
                <div key={x.id} className="group flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text">{x.label}</p>
                    <p className="text-[11px] text-faint">
                      {x.tag} · {relLabel(x.date)}
                    </p>
                  </div>
                  <span
                    className="tabular text-sm font-semibold"
                    style={{ color: x.amount >= 0 ? "var(--success)" : "var(--text)" }}
                  >
                    {x.amount >= 0 ? "+" : ""}
                    {fmtMoney(x.amount, currency)}
                  </span>
                  <button
                    onClick={() => setEditing(x)}
                    aria-label="Edit transaction"
                    className="grid h-6 w-6 place-items-center rounded-md text-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-muted group-hover:opacity-100"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <TxnForm open={creating} onClose={() => setCreating(false)} />
      <TxnForm open={!!editing} onClose={() => setEditing(undefined)} txn={editing} />
      <SavingsModal target={savingsModal} onClose={() => setSavingsModal(undefined)} />
    </Hydrate>
  );
}

function SavingsModal({
  target,
  onClose,
}: {
  target?: SavingsGoal | "new";
  onClose: () => void;
}) {
  const { addSavings, updateSavings, addToSavings, deleteSavings, currency } = useMoneyData();
  const isNew = target === "new";
  const goal = isNew || !target ? undefined : target;

  const [name, setName] = useState("");
  const [targetAmt, setTargetAmt] = useState("");
  const [add, setAdd] = useState("");
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const key = isNew ? "new" : (goal?.id ?? null);
  if (target && key !== loadedKey) {
    setLoadedKey(key);
    setName(goal?.name ?? "");
    setTargetAmt(goal ? String(goal.target) : "");
    setAdd("");
  }
  if (!target && loadedKey) setLoadedKey(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !Number(targetAmt)) return;
    if (isNew) {
      addSavings(name.trim(), Number(targetAmt));
    } else if (goal) {
      updateSavings(goal.id, { name: name.trim(), target: Number(targetAmt) });
      if (Number(add)) addToSavings(goal.id, Number(add));
    }
    onClose();
  };

  return (
    <Modal open={!!target} onClose={onClose} title={isNew ? "New savings goal" : "Savings goal"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency fund" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Target (${currency})`}>
            <input type="number" min={1} className={inputCls} value={targetAmt} onChange={(e) => setTargetAmt(e.target.value)} placeholder="0" />
          </Field>
          {!isNew && (
            <Field label={`Add money (${currency})`}>
              <input type="number" className={inputCls} value={add} onChange={(e) => setAdd(e.target.value)} placeholder="+0" />
            </Field>
          )}
        </div>
        {!isNew && goal && (
          <p className="flex items-center gap-1.5 text-[12px] text-faint">
            <PiggyBank className="h-3.5 w-3.5" /> Currently {fmtMoney(goal.current, currency)} saved.
          </p>
        )}
        <FormFooter
          submitLabel={isNew ? "Create goal" : "Save"}
          disabled={!name.trim() || !Number(targetAmt)}
          onDelete={
            goal
              ? () => {
                  deleteSavings(goal.id);
                  onClose();
                }
              : undefined
          }
        />
      </form>
    </Modal>
  );
}
