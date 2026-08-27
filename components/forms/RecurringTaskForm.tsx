"use client";

import { useState } from "react";
import { Modal, Field, FormFooter, Segmented, inputCls } from "@/components/ui/Modal";
import {
  useRecurringData,
  type RecurringTask,
  type RecurrenceFreq,
  type RecurrenceRule,
} from "@/lib/data/domains/recurring";
import { todayISO } from "@/lib/date";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function RecurringTaskForm(props: {
  open: boolean;
  onClose: () => void;
  task?: RecurringTask;
}) {
  if (!props.open) return null;
  return <RecurringTaskFormInner key={props.task?.id ?? "new"} {...props} />;
}

function RecurringTaskFormInner({
  open,
  onClose,
  task,
}: {
  open: boolean;
  onClose: () => void;
  task?: RecurringTask;
}) {
  const { addRecurring, updateRecurring, deleteRecurring } = useRecurringData();

  const [title, setTitle] = useState(task?.title ?? "");
  const [freq, setFreq] = useState<RecurrenceFreq>(task?.rule.freq ?? "weekly");
  const [weekDays, setWeekDays] = useState<number[]>(task?.rule.weekDays ?? [0, 2, 4]); // Mon/Wed/Fri
  const [monthDay, setMonthDay] = useState(task?.rule.monthDay ?? 1);
  const [intervalDays, setIntervalDays] = useState(task?.rule.intervalDays ?? 2);
  const [startDate, setStartDate] = useState(task?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(task?.endDate ?? "");

  const toggleWeekDay = (d: number) => {
    setWeekDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const rule: RecurrenceRule = { freq };
    if (freq === "weekly") rule.weekDays = weekDays.length ? weekDays : [0];
    if (freq === "monthly") rule.monthDay = monthDay;
    if (freq === "custom") rule.intervalDays = intervalDays;

    const input = {
      title: title.trim(),
      rule,
      startDate: startDate || todayISO(),
      endDate: endDate || undefined,
    };

    if (task) await updateRecurring(task.id, input);
    else await addRecurring(input);
    onClose();
  };

  const isDirty = Boolean(title.trim() !== (task?.title ?? ""));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Edit recurring task" : "New recurring task"}
      preventBackdropClose={true}
      dirty={isDirty}
      confirmDiscardMessage="You have unsaved changes in this recurring task. Discard edits?"
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="What recurs?">
          <input
            autoFocus
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Pay rent, Oil change…"
          />
        </Field>

        <Field label="Frequency">
          <Segmented
            value={freq}
            onChange={setFreq}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
              { value: "custom", label: "Custom" },
            ]}
          />
        </Field>

        {/* Weekly: day picker */}
        {freq === "weekly" && (
          <Field label="Which days?">
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleWeekDay(i)}
                  className={`flex-1 rounded-[10px] py-2 text-[12px] font-semibold transition-all ${
                    weekDays.includes(i)
                      ? "bg-accent text-accent-fg shadow-sm"
                      : "bg-surface-2 text-faint hover:text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {/* Monthly: day of month */}
        {freq === "monthly" && (
          <Field label="Day of the month">
            <input
              type="number"
              min={1}
              max={31}
              className={inputCls}
              value={monthDay}
              onChange={(e) => setMonthDay(Number(e.target.value))}
            />
          </Field>
        )}

        {/* Custom: every N days */}
        {freq === "custom" && (
          <Field label="Every N days">
            <input
              type="number"
              min={1}
              max={365}
              className={inputCls}
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input
              type="date"
              className={inputCls}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End date (optional)">
            <input
              type="date"
              className={inputCls}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>

        <FormFooter
          submitLabel={task ? "Save changes" : "Add recurring task"}
          disabled={!title.trim()}
          onDelete={
            task
              ? async () => {
                  try {
                    await deleteRecurring(task.id);
                    onClose();
                  } catch (err) {
                    console.error("Failed to delete recurring task:", err);
                  }
                }
              : undefined
          }
        />
      </form>
    </Modal>
  );
}
