"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Modal, Field, FormFooter, Segmented, inputCls } from "@/components/ui/Modal";
import {
  useMoneyData,
  INCOME_TAGS,
  EXPENSE_TAGS,
  type Txn,
} from "@/lib/data/domains/money";
import { todayISO } from "@/lib/date";

export function TxnForm({
  open,
  onClose,
  txn,
  defaultAccountId,
}: {
  open: boolean;
  onClose: () => void;
  txn?: Txn;
  defaultAccountId?: string;
}) {
  const { addTxn, updateTxn, deleteTxn, currency, accounts } = useMoneyData();

  const initialKind = txn
    ? txn.transferAccountId
      ? "transfer"
      : txn.amount >= 0
      ? "income"
      : "expense"
    : "expense";

  const initialTags = initialKind === "income" ? INCOME_TAGS : EXPENSE_TAGS;

  const [label, setLabel] = useState(txn?.label ?? "");
  const [amount, setAmount] = useState(txn ? String(Math.abs(txn.amount)) : "");
  const [kind, setKind] = useState<"expense" | "income" | "transfer">(initialKind);
  const [tag, setTag] = useState<string>(txn?.tag ?? initialTags[0]);
  const [date, setDate] = useState(txn?.date ?? todayISO());
  const [accountId, setAccountId] = useState<string>(
    txn?.accountId ?? defaultAccountId ?? (accounts[0]?.id ?? "")
  );
  const [transferAccountId, setTransferAccountId] = useState<string>(
    txn?.transferAccountId ?? (accounts[1]?.id ?? accounts[0]?.id ?? "")
  );

  const [prevTxnId, setPrevTxnId] = useState<string | undefined>(txn?.id);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen || txn?.id !== prevTxnId) {
    setPrevOpen(open);
    setPrevTxnId(txn?.id);
    if (open) {
      const resetKind = txn
        ? txn.transferAccountId
          ? "transfer"
          : txn.amount >= 0
          ? "income"
          : "expense"
        : "expense";
      const resetTags = resetKind === "income" ? INCOME_TAGS : EXPENSE_TAGS;
      setLabel(txn?.label ?? "");
      setAmount(txn ? String(Math.abs(txn.amount)) : "");
      setKind(resetKind);
      setTag(txn?.tag ?? resetTags[0]);
      setDate(txn?.date ?? todayISO());
      setAccountId(txn?.accountId ?? defaultAccountId ?? (accounts[0]?.id ?? ""));
      setTransferAccountId(txn?.transferAccountId ?? (accounts[1]?.id ?? accounts[0]?.id ?? ""));
    }
  }

  const handleKindChange = (newKind: "expense" | "income" | "transfer") => {
    setKind(newKind);
    if (newKind === "transfer") {
      setTag("Transfer");
      if (!label || label === "Expense" || label === "Income") {
        setLabel("Transfer");
      }
      if (!transferAccountId && accounts.length > 1) {
        setTransferAccountId(accounts.find((a) => a.id !== accountId)?.id ?? accounts[1]?.id ?? "");
      }
    } else {
      const newTags = newKind === "income" ? (INCOME_TAGS as readonly string[]) : (EXPENSE_TAGS as readonly string[]);
      if (!newTags.includes(tag) || tag === "Transfer") {
        setTag(newTags[0]);
      }
    }
  };

  const availableTags = useMemo(() => {
    if (kind === "transfer") return ["Transfer"];
    const base: readonly string[] = kind === "income" ? INCOME_TAGS : EXPENSE_TAGS;
    if (tag && !base.includes(tag)) {
      return [tag, ...base];
    }
    return base;
  }, [kind, tag]);

  const n = Number(amount);
  const valid =
    (label.trim().length > 0 || kind === "transfer") &&
    n > 0 &&
    (kind !== "transfer" || (accountId && transferAccountId && accountId !== transferAccountId));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;

    const input = {
      label: label.trim() || (kind === "transfer" ? "Account Transfer" : kind === "income" ? "Income" : "Expense"),
      amount: kind === "expense" ? -n : n,
      tag: kind === "transfer" ? "Transfer" : tag,
      date,
      accountId: accountId || undefined,
      transferAccountId: kind === "transfer" ? transferAccountId || undefined : undefined,
    };

    if (txn) updateTxn(txn.id, input);
    else addTxn(input);
    onClose();
  };

  const isDirty = Boolean(
    label.trim() !== (txn?.label ?? "") ||
    amount.trim() !== (txn ? `${Math.abs(txn.amount)}` : "") ||
    kind !== (txn ? (txn.transferAccountId ? "transfer" : txn.amount >= 0 ? "income" : "expense") : "expense") ||
    tag !== (txn?.tag ?? (kind === "income" ? INCOME_TAGS[0] : EXPENSE_TAGS[0])) ||
    accountId !== (txn?.accountId ?? defaultAccountId ?? (accounts[0]?.id ?? "")) ||
    (kind === "transfer" && transferAccountId !== (txn?.transferAccountId ?? (accounts[1]?.id ?? accounts[0]?.id ?? "")))
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={txn ? (txn.transferAccountId ? "Edit transfer" : "Edit transaction") : "Log transaction"}
      preventBackdropClose={true}
      dirty={isDirty}
      confirmDiscardMessage="You have unsaved changes in this transaction. Discard edits?"
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Type Selector: Expense | Income | Transfer */}
        <Segmented
          value={kind}
          onChange={handleKindChange}
          options={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
            { value: "transfer", label: "Transfer" },
          ]}
        />

        {kind === "transfer" ? (
          <div className="space-y-3 rounded-[16px] border border-border bg-surface-2/60 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-text">
              <ArrowRightLeft className="h-4 w-4 text-accent" />
              <span>Transfer Between Accounts</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From Account">
                <select
                  className={inputCls}
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accounts.length === 0 && <option value="">No accounts available</option>}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.id === transferAccountId}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="To Account">
                <select
                  className={inputCls}
                  value={transferAccountId}
                  onChange={(e) => setTransferAccountId(e.target.value)}
                >
                  {accounts.length === 0 && <option value="">No accounts available</option>}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.id === accountId}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {accountId && transferAccountId && accountId === transferAccountId && (
              <p className="text-[11px] text-danger">Source and destination accounts must be different.</p>
            )}
          </div>
        ) : null}

        <Field label={kind === "transfer" ? "Note / Description (Optional)" : "What was it?"}>
          <input
            autoFocus
            className={inputCls}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={
              kind === "transfer"
                ? "e.g. Monthly savings contribution"
                : kind === "income"
                ? "e.g. Freelance — landing page"
                : "e.g. Organic Groceries / Dev tools"
            }
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Amount (${currency})`}>
            <input
              className={inputCls}
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </Field>

          {kind !== "transfer" ? (
            <Field label="Account / Card">
              <select
                className={inputCls}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">Unassigned (General)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Date">
              <input
                type="date"
                className={inputCls}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          )}
        </div>

        {kind !== "transfer" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category / Tag">
              <select
                className={inputCls}
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              >
                {availableTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Date">
              <input
                type="date"
                className={inputCls}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
        )}

        <FormFooter
          onDelete={txn ? () => { deleteTxn(txn.id); onClose(); } : undefined}
          submitLabel={txn ? "Save changes" : kind === "transfer" ? "Log transfer" : "Log transaction"}
          disabled={!valid}
        />
      </form>
    </Modal>
  );
}
