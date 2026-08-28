"use client";

import { useState } from "react";
import {
  Landmark,
  CreditCard,
  Banknote,
  PiggyBank,
  Wallet,
  Coins,
  Briefcase,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Modal, Field, FormFooter, inputCls } from "@/components/ui/Modal";
import {
  useMoneyData,
  ACCOUNT_TYPES,
  type Account,
  type AccountType,
} from "@/lib/data/domains/money";

export const ACCOUNT_THEMES = [
  { id: "emerald", label: "Emerald", bg: "from-emerald-600/90 to-teal-800/90", border: "border-emerald-500/30", dot: "#10b981", accent: "var(--success, #10b981)" },
  { id: "blue", label: "Ocean Blue", bg: "from-blue-600/90 to-cyan-800/90", border: "border-blue-500/30", dot: "#3b82f6", accent: "#3b82f6" },
  { id: "indigo", label: "Royal Indigo", bg: "from-indigo-600/90 to-blue-950/90", border: "border-indigo-500/30", dot: "#6366f1", accent: "#6366f1" },
  { id: "purple", label: "Purple Amethyst", bg: "from-purple-600/90 to-violet-950/90", border: "border-purple-500/30", dot: "#a855f7", accent: "#a855f7" },
  { id: "amber", label: "Gold Amber", bg: "from-amber-600/90 to-orange-800/90", border: "border-amber-500/30", dot: "#f59e0b", accent: "#f59e0b" },
  { id: "rose", label: "Crimson Rose", bg: "from-rose-600/90 to-pink-900/90", border: "border-rose-500/30", dot: "#f43f5e", accent: "var(--danger, #f43f5e)" },
  { id: "slate", label: "Titanium Slate", bg: "from-slate-700/90 to-zinc-900/90", border: "border-slate-500/30", dot: "#64748b", accent: "#94a3b8" },
];

export const ACCOUNT_ICON_MAP = {
  landmark: Landmark,
  "credit-card": CreditCard,
  banknote: Banknote,
  "piggy-bank": PiggyBank,
  wallet: Wallet,
  coins: Coins,
  briefcase: Briefcase,
  shield: ShieldCheck,
};

export type AccountIconKey = keyof typeof ACCOUNT_ICON_MAP;

export function AccountIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = name && name in ACCOUNT_ICON_MAP ? ACCOUNT_ICON_MAP[name as AccountIconKey] : Landmark;
  return <Icon className={className} />;
}

export function AccountModal({
  open,
  onClose,
  account,
}: {
  open: boolean;
  onClose: () => void;
  account?: Account;
}) {
  const { addAccount, updateAccount, deleteAccount, currency: defaultCurrency } = useMoneyData();

  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "bank");
  const [initialBalance, setInitialBalance] = useState(account ? String(account.initialBalance) : "0");
  const [currency, setCurrency] = useState(account?.currency ?? "");
  const [color, setColor] = useState(account?.color ?? "emerald");
  const [icon, setIcon] = useState<AccountIconKey>((account?.icon as AccountIconKey) ?? "landmark");

  const [prevAccountId, setPrevAccountId] = useState<string | undefined>(account?.id);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen || account?.id !== prevAccountId) {
    setPrevOpen(open);
    setPrevAccountId(account?.id);
    if (open) {
      setName(account?.name ?? "");
      setType(account?.type ?? "bank");
      setInitialBalance(account ? String(account.initialBalance) : "0");
      setCurrency(account?.currency ?? "");
      setColor(account?.color ?? "emerald");
      setIcon((account?.icon as AccountIconKey) ?? "landmark");
    }
  }

  const valid = name.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;

    const input = {
      name: name.trim(),
      type,
      initialBalance: Number(initialBalance) || 0,
      currency: currency.trim() ? currency.trim().toUpperCase() : undefined,
      color,
      icon,
    };

    if (account) {
      updateAccount(account.id, input);
    } else {
      addAccount(input);
    }
    onClose();
  };

  const isDirty = Boolean(
    name.trim() !== (account?.name ?? "") ||
    type !== (account?.type ?? "bank") ||
    initialBalance.trim() !== (account ? String(account.initialBalance) : "0") ||
    currency !== (account?.currency ?? "") ||
    color !== (account?.color ?? "emerald") ||
    icon !== ((account?.icon as AccountIconKey) ?? "landmark")
  );

  const activeTheme = ACCOUNT_THEMES.find((t) => t.id === color) || ACCOUNT_THEMES[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account ? "Edit Account / Card" : "New Account or Card"}
      preventBackdropClose={true}
      dirty={isDirty}
      confirmDiscardMessage="Discard unsaved changes to this account?"
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Live Card Preview */}
        <div
          className={`relative overflow-hidden rounded-[18px] border ${activeTheme.border} bg-gradient-to-br ${activeTheme.bg} p-4 text-white shadow-md`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
              {ACCOUNT_TYPES.find((t) => t.type === type)?.label ?? "Account"}
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 backdrop-blur-sm">
              <AccountIcon name={icon} className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-base font-semibold truncate text-white/95">
              {name.trim() || "Account Name"}
            </h3>
            <p className="text-[12px] opacity-80 mt-0.5">
              Starting Balance: {initialBalance || "0"} {currency || defaultCurrency}
            </p>
          </div>
        </div>

        <Field label="Account or Card Name">
          <input
            autoFocus
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Checking, Visa Gold, Cash Stash"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Account Type">
            <select
              className={inputCls}
              value={type}
              onChange={(e) => {
                const nextType = e.target.value as AccountType;
                setType(nextType);
                if (nextType === "card" && icon === "landmark") setIcon("credit-card");
                if (nextType === "cash" && icon === "landmark") setIcon("banknote");
                if (nextType === "savings" && icon === "landmark") setIcon("piggy-bank");
                if (nextType === "wallet" && icon === "landmark") setIcon("wallet");
                if (nextType === "investment" && icon === "landmark") setIcon("coins");
              }}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Currency">
            <select
              className={inputCls}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="">Default ({defaultCurrency})</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="DA">DZD (DA)</option>
              <option value="CAD">CAD ($)</option>
              <option value="AUD">AUD ($)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="CHF">CHF (Fr)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="SAR">SAR (﷼)</option>
              <option value="TRY">TRY (₺)</option>
            </select>
          </Field>

          <Field label={`Starting Balance (${currency || defaultCurrency})`}>
            <input
              className={inputCls}
              type="number"
              step="any"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>

        {/* Color Palette Presets */}
        <div>
          <span className="mb-1.5 block text-[11px] sm:text-[12px] font-medium text-muted">
            Card Theme & Color
          </span>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setColor(theme.id)}
                title={theme.label}
                aria-label={`Theme ${theme.label}`}
                className="grid h-7 w-7 place-items-center rounded-full transition-transform hover:scale-110"
                style={{
                  background: theme.dot,
                  outline: color === theme.id ? `2px solid var(--ring)` : "none",
                  outlineOffset: 2,
                }}
              >
                {color === theme.id && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Icon Presets */}
        <div>
          <span className="mb-1.5 block text-[11px] sm:text-[12px] font-medium text-muted">
            Card Icon
          </span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ACCOUNT_ICON_MAP).map(([key, Icon]) => {
              const active = icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key as AccountIconKey)}
                  className={`grid h-9 w-9 place-items-center rounded-xl border transition-all ${
                    active
                      ? "border-accent bg-accent/15 text-accent shadow-sm"
                      : "border-border bg-surface-2 text-faint hover:text-text hover:bg-surface-hover"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>

        <FormFooter
          onDelete={
            account
              ? () => {
                  deleteAccount(account.id);
                  onClose();
                }
              : undefined
          }
          submitLabel={account ? "Save changes" : "Create account"}
          disabled={!valid}
        />
      </form>
    </Modal>
  );
}
