"use client";

import { useState } from "react";
import {
  Pencil,
  PiggyBank,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
  Building2,
  ArrowRightLeft,
  FilterX,
} from "lucide-react";
import {
  useMoneyData,
  fmtMoney,
  accountBalance,
  totalNetWorth,
  monthlyAgg,
  monthNet,
  runwayMonths,
  ACCOUNT_TYPES,
  type Txn,
  type SavingsGoal,
  type Account,
} from "@/lib/data/domains/money";
import { Card, ProgressBar, SectionTitle } from "@/components/ui/primitives";
import { StatTile } from "@/components/ui/charts";
import { TxnForm } from "@/components/forms/TxnForm";
import { AccountModal, ACCOUNT_THEMES, AccountIcon } from "@/components/forms/AccountModal";
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

function formatMultiCurrencyBalance(accounts: Account[], transactions: Txn[], defaultCurrency: string): string {
  const totals = new Map<string, number>();
  if (accounts.length === 0) {
    totals.set(defaultCurrency, transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0));
  } else {
    for (const account of accounts) {
      const code = account.currency || defaultCurrency;
      totals.set(code, (totals.get(code) || 0) + accountBalance(account, transactions));
    }
  }
  return [...totals.entries()]
    .filter(([, amount]) => amount !== 0 || totals.size === 1)
    .map(([code, amount]) => fmtMoney(amount, code))
    .join(" · ");
}

export default function MoneyPage() {
  const { accounts, transactions, savings, currency, setCurrency } = useMoneyData();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Txn | undefined>();
  const [savingsModal, setSavingsModal] = useState<SavingsGoal | "new" | undefined>();
  const [accountModal, setAccountModal] = useState<Account | "new" | undefined>();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Computed values based on selection
  const netWorth = totalNetWorth(accounts, transactions);
  const netWorthDisplay = formatMultiCurrencyBalance(accounts, transactions, currency);
  const activeBal = selectedAccount
    ? accountBalance(selectedAccount, transactions)
    : netWorth;

  const { net, trendPct } = monthNet(transactions, selectedAccountId ?? undefined);
  const runway = runwayMonths(transactions, accounts, selectedAccountId ?? undefined);
  const months = monthlyAgg(transactions, 6, selectedAccountId ?? undefined);
  const chartMax = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1);

  // Filter recent transactions
  const filteredTxns = selectedAccountId
    ? transactions.filter((t) => t.accountId === selectedAccountId || t.transferAccountId === selectedAccountId)
    : transactions;

  const recent = [...filteredTxns]
    .filter((x) => x.label !== "Opening balance")
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 10);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  return (
    <Hydrate>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div>
            <p className="text-[13.5px] sm:text-[15px] text-muted">Every account, card, and transaction in one clear picture.</p>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3">
            <select
              className="bg-surface-2/80 rounded-lg px-2.5 py-1 text-xs sm:text-[13px] font-medium text-muted outline-none cursor-pointer border border-border/60"
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
              className="btn-hero flex items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-[13px] font-semibold shadow-sm shrink-0"
            >
              <Plus className="h-4 w-4" /> Log transaction
            </button>
          </div>
        </div>

        {/* ACCOUNTS & CARDS SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
                Accounts & Cards
              </h2>
              {selectedAccountId && (
                <button
                  onClick={() => setSelectedAccountId(null)}
                  className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-accent hover:bg-surface-hover transition-colors"
                >
                  <FilterX className="h-3 w-3" /> Clear filter
                </button>
              )}
            </div>
            <button
              onClick={() => setAccountModal("new")}
              className="flex items-center gap-1 text-[12px] font-medium text-accent hover:opacity-80 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" /> Add Account / Card
            </button>
          </div>

          {/* Cards Carousel / Grid */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Net Worth / All Accounts Card */}
            <button
              type="button"
              onClick={() => setSelectedAccountId(null)}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-[20px] border p-4 text-left transition-all ${
                selectedAccountId === null
                  ? "border-accent bg-gradient-to-br from-surface-1 to-surface-2 shadow-md ring-2 ring-accent/30"
                  : "border-border bg-surface hover:border-border-strong hover:bg-surface-2/60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Total Net Worth
                </span>
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-text">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xl font-bold text-text tabular">
                  {netWorthDisplay}
                </p>
                <p className="text-[11px] text-faint mt-0.5">
                  {accounts.length} active account{accounts.length === 1 ? "" : "s"}
                </p>
              </div>
            </button>

            {/* Individual Account Cards */}
            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              const theme = ACCOUNT_THEMES.find((t) => t.id === acc.color) || ACCOUNT_THEMES[0];
              const accBal = accountBalance(acc, transactions);
              const accCurr = acc.currency || currency;
              const typeLabel = ACCOUNT_TYPES.find((t) => t.type === acc.type)?.label || "Account";

              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountId(isSelected ? null : acc.id)}
                  className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-[20px] border p-4 text-white transition-all shadow-sm ${
                    isSelected ? "ring-2 ring-white/90 scale-[1.02] shadow-lg" : "hover:brightness-105 hover:scale-[1.01]"
                  } bg-gradient-to-br ${theme.bg} ${theme.border}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">
                      {typeLabel}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAccountModal(acc);
                        }}
                        aria-label="Edit account"
                        className="grid h-6 w-6 place-items-center rounded-md bg-black/20 text-white/80 opacity-0 transition-opacity hover:bg-black/40 hover:text-white group-hover:opacity-100"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/15 backdrop-blur-sm">
                        <AccountIcon name={acc.icon} className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-sm font-semibold truncate text-white/95">
                      {acc.name}
                    </h3>
                    <p className="text-lg font-bold tabular text-white mt-0.5">
                      {fmtMoney(accBal, accCurr)}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Quick Add Card if < 3 accounts */}
            {accounts.length === 0 && (
              <button
                type="button"
                onClick={() => setAccountModal("new")}
                className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border p-4 text-center text-muted transition-colors hover:border-accent hover:text-accent sm:col-span-2 lg:col-span-3"
              >
                <Plus className="h-5 w-5 mb-1 text-accent" />
                <span className="text-[13px] font-semibold text-text">Add your first account or card</span>
                <span className="text-[11px] text-faint mt-0.5">Track bank accounts, credit cards, or cash wallets automatically</span>
              </button>
            )}
          </div>
        </div>

        {/* Hero stats — calculated for all or selected account */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1 lg:[&>*:last-child]:col-span-1">
          <StatTile
            label={selectedAccount ? `${selectedAccount.name} Runway` : "Runway"}
            value={runway ?? "—"}
            unit={runway ? "months" : undefined}
            icon={<Wallet className="h-4 w-4" />}
            hint="balance ÷ avg monthly spend"
            hero
          />
          <StatTile
            label={selectedAccount ? `Net (${selectedAccount.name})` : "Net this month"}
            value={fmtMoney(net, currency)}
            icon={net >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            accent={net >= 0 ? "var(--success)" : "var(--danger)"}
            delta={trendPct}
            hint={trendPct !== null ? "vs last month" : "first month"}
          />
          <StatTile
            label={selectedAccount ? `${selectedAccount.name} Balance` : "Total Balance"}
            value={selectedAccount ? fmtMoney(activeBal, selectedAccount.currency || currency) : netWorthDisplay}
            hint={selectedAccount ? "starting balance + transactions" : "all accounts & transactions"}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Income vs expense */}
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-faint">
                {selectedAccount ? `${selectedAccount.name} · ` : ""}Income vs expenses · 6 months
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
          <SectionTitle
            action={
              selectedAccountId ? (
                <span className="text-[12px] text-muted">
                  Showing transactions for <strong className="text-text">{selectedAccount?.name}</strong>
                </span>
              ) : undefined
            }
          >
            Recent transactions
          </SectionTitle>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-faint">Nothing logged yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((x) => {
                const isTransfer = Boolean(x.transferAccountId);
                const fromAcc = x.accountId ? accountMap.get(x.accountId) : undefined;
                const toAcc = x.transferAccountId ? accountMap.get(x.transferAccountId) : undefined;

                return (
                  <div key={x.id} className="group flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isTransfer && <ArrowRightLeft className="h-3.5 w-3.5 text-accent shrink-0" />}
                        <p className="truncate text-sm text-text font-medium">{x.label}</p>
                      </div>
                      <p className="text-[11px] text-faint mt-0.5">
                        {x.tag} · {relLabel(x.date)}
                        {fromAcc && !toAcc && ` · ${fromAcc.name}`}
                        {fromAcc && toAcc && ` · ${fromAcc.name} → ${toAcc.name}`}
                      </p>
                    </div>
                    <span
                      className="tabular text-sm font-semibold"
                      style={{
                        color: isTransfer
                          ? "var(--accent)"
                          : x.amount >= 0
                          ? "var(--success)"
                          : "var(--text)",
                      }}
                    >
                      {isTransfer ? "" : x.amount >= 0 ? "+" : ""}
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
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <TxnForm
        open={creating}
        onClose={() => setCreating(false)}
        defaultAccountId={selectedAccountId ?? undefined}
      />
      <TxnForm open={!!editing} onClose={() => setEditing(undefined)} txn={editing} />
      <AccountModal
        open={!!accountModal}
        onClose={() => setAccountModal(undefined)}
        account={accountModal === "new" || !accountModal ? undefined : accountModal}
      />
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
