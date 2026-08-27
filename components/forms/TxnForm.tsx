"use client";

import { useMemo, useState } from "react";
import { Modal, Field, FormFooter, Segmented, inputCls } from "@/components/ui/Modal";
import { useMoneyData, INCOME_TAGS, EXPENSE_TAGS, type Txn } from "@/lib/data/domains/money";
import { todayISO } from "@/lib/date";

export function TxnForm({
  open,
  onClose,
  txn,
}: {
  open: boolean;
  onClose: () => void;
  txn?: Txn;
}) {
  const { addTxn, updateTxn, deleteTxn, currency } = useMoneyData();

  const initialKind = txn ? (txn.amount >= 0 ? "income" : "expense") : "expense";
  const initialTags = initialKind === "income" ? INCOME_TAGS : EXPENSE_TAGS;

  const [label, setLabel] = useState(txn?.label ?? "");
  const [amount, setAmount] = useState(txn ? String(Math.abs(txn.amount)) : "");
  const [kind, setKind] = useState<"income" | "expense">(initialKind);
  const [tag, setTag] = useState<string>(txn?.tag ?? initialTags[0]);
  const [date, setDate] = useState(txn?.date ?? todayISO());

  const [prevTxnId, setPrevTxnId] = useState<string | undefined>(txn?.id);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen || txn?.id !== prevTxnId) {
    setPrevOpen(open);
    setPrevTxnId(txn?.id);
    if (open) {
      const resetKind = txn ? (txn.amount >= 0 ? "income" : "expense") : "expense";
      const resetTags = resetKind === "income" ? INCOME_TAGS : EXPENSE_TAGS;
      setLabel(txn?.label ?? "");
      setAmount(txn ? String(Math.abs(txn.amount)) : "");
      setKind(resetKind);
      setTag(txn?.tag ?? resetTags[0]);
      setDate(txn?.date ?? todayISO());
    }
  }

  const handleKindChange = (newKind: "income" | "expense") => {
    setKind(newKind);
    const newTags = newKind === "income" ? (INCOME_TAGS as readonly string[]) : (EXPENSE_TAGS as readonly string[]);
    if (!newTags.includes(tag)) {
      setTag(newTags[0]);
    }
  };

  const availableTags = useMemo(() => {
    const base: readonly string[] = kind === "income" ? INCOME_TAGS : EXPENSE_TAGS;
    if (tag && !base.includes(tag)) {
      return [tag, ...base];
    }
    return base;
  }, [kind, tag]);

  const n = Number(amount);
  const valid = label.trim().length > 0 && n > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const input = {
      label: label.trim(),
      amount: kind === "income" ? n : -n,
      tag,
      date,
    };
    if (txn) updateTxn(txn.id, input);
    else addTxn(input);
    onClose();
  };

  const isDirty = Boolean(
    label.trim() !== (txn?.label ?? "") ||
    amount.trim() !== (txn ? `${Math.abs(txn.amount)}` : "") ||
    kind !== (txn ? (txn.amount >= 0 ? "income" : "expense") : "expense") ||
    tag !== (txn?.tag ?? (kind === "income" ? INCOME_TAGS[0] : EXPENSE_TAGS[0]))
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={txn ? "Edit transaction" : "Log transaction"}
      preventBackdropClose={true}
      dirty={isDirty}
      confirmDiscardMessage="You have unsaved changes in this transaction. Discard edits?"
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="What was it?">
          <input
            autoFocus
            className={inputCls}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={kind === "income" ? "e.g. Freelance — landing page" : "e.g. Cleaning stuff / groceries"}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Segmented
              value={kind}
              onChange={handleKindChange}
              options={[
                { value: "expense", label: "Expense" },
                { value: "income", label: "Income" },
              ]}
            />
          </Field>

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
        </div>

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

        <FormFooter
          onDelete={txn ? () => { deleteTxn(txn.id); onClose(); } : undefined}
          submitLabel={txn ? "Save changes" : "Log transaction"}
          disabled={!valid}
        />
      </form>
    </Modal>
  );
}
