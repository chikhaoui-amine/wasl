"use client";

import { useState } from "react";
import { Moon, Plus, Minus, Check, Star, Calendar, MessageSquare } from "lucide-react";
import { useHealthData } from "@/lib/data/domains/health";
import { Modal, FormFooter, inputCls } from "@/components/ui/Modal";
import { addDays, relLabel, todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

interface SleepLoggerModalProps {
  open: boolean;
  onClose: () => void;
  initialDate?: string;
}

function SleepLoggerForm({
  initialDate,
  onClose,
}: {
  initialDate?: string;
  onClose: () => void;
}) {
  const { day, patchDay, goals } = useHealthData();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayISO());

  const targetDay = day(selectedDate);
  const [sleepHours, setSleepHours] = useState<number>(targetDay.sleepH || 8);
  const [quality, setQuality] = useState<string>(targetDay.sleepQuality || "Good");
  const [note, setNote] = useState<string>(targetDay.sleepNote || "");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // When date selector changes within modal, update inputs with that day's saved data
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    const cur = day(newDate);
    setSleepHours(cur.sleepH || 8);
    setQuality(cur.sleepQuality || "Good");
    setNote(cur.sleepNote || "");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    patchDay(
      {
        sleepH: Number(sleepHours) || 0,
        sleepQuality: quality,
        sleepNote: note.trim() || undefined,
      },
      selectedDate,
    );
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const PRESETS = [6.0, 7.0, 7.5, 8.0, 8.5, 9.0];

  const QUALITIES = [
    { label: "Deep & Restful", value: "Deep & Restful", color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
    { label: "Good", value: "Good", color: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10" },
    { label: "Fair / Interrupted", value: "Fair", color: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
    { label: "Poor / Restless", value: "Poor", color: "border-red-500/40 text-red-400 bg-red-500/10" },
  ];

  const t = todayISO();
  const y = addDays(t, -1);

  if (savedSuccess) {
    return (
      <div className="py-8 text-center space-y-3">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 animate-bounce">
          <Check className="h-6 w-6 stroke-[3]" />
        </div>
        <h3 className="font-bold text-lg text-text">Sleep Log Saved!</h3>
        <p className="text-xs text-muted">
          Updated {relLabel(selectedDate)}&apos;s sleep to {sleepHours} hours ({quality}).
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Date Selector Header */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-accent" /> Date of Sleep
          </span>
          <span className="text-[10px] text-accent font-semibold">
            {relLabel(selectedDate)}
          </span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleDateChange(t)}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
              selectedDate === t
                ? "bg-accent/15 border-accent text-accent shadow-sm"
                : "bg-surface-2 border-border/80 text-muted hover:text-text",
            )}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => handleDateChange(y)}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
              selectedDate === y
                ? "bg-accent/15 border-accent text-accent shadow-sm"
                : "bg-surface-2 border-border/80 text-muted hover:text-text",
            )}
          >
            Yesterday
          </button>
          <input
            type="date"
            max={t}
            value={selectedDate}
            onChange={(e) => e.target.value && handleDateChange(e.target.value)}
            className={cn(
              "flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold border bg-surface-2 border-border/80 text-text outline-none focus:border-accent",
            )}
          />
        </div>
      </div>

      {/* Main Sleep Duration Counter */}
      <div className="rounded-2xl border border-border/80 bg-surface-2/40 p-4 text-center space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center justify-center gap-1.5">
          <Moon className="h-4 w-4 text-accent" /> Sleep Duration
        </span>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setSleepHours((prev) => Math.max(0, Number((prev - 0.5).toFixed(1))))}
            className="grid h-10 w-10 place-items-center rounded-xl bg-surface-3 text-text hover:bg-surface-4 hover:scale-105 active:scale-95 transition-all"
          >
            <Minus className="h-4 w-4" />
          </button>

          <div className="min-w-[120px]">
            <div className="font-display text-4xl font-black text-text tracking-tight">
              {sleepHours}
              <span className="text-base font-normal text-muted ml-1.5">hrs</span>
            </div>
            {goals.sleepH && (
              <p className="text-[10px] text-muted font-medium mt-0.5">
                Goal: {goals.sleepH} hrs (
                {sleepHours >= goals.sleepH ? (
                  <span className="text-emerald-400 font-bold">Met ✓</span>
                ) : (
                  <span className="text-amber-400 font-bold">
                    {(goals.sleepH - sleepHours).toFixed(1)} hrs left
                  </span>
                )}
                )
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSleepHours((prev) => Math.min(24, Number((prev + 0.5).toFixed(1))))}
            className="grid h-10 w-10 place-items-center rounded-xl bg-surface-3 text-text hover:bg-surface-4 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          {PRESETS.map((hrs) => (
            <button
              key={hrs}
              type="button"
              onClick={() => setSleepHours(hrs)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border",
                sleepHours === hrs
                  ? "bg-accent text-bg border-accent shadow-sm"
                  : "bg-surface-3/80 text-muted border-transparent hover:text-text hover:bg-surface-4",
              )}
            >
              {hrs}h
            </button>
          ))}
        </div>
      </div>

      {/* Sleep Quality Selector */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-accent" /> Quality Assessment
        </label>
        <div className="grid grid-cols-2 gap-2">
          {QUALITIES.map((q) => {
            const isSelected = quality === q.value;
            return (
              <button
                key={q.value}
                type="button"
                onClick={() => setQuality(q.value)}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-2.5 text-left text-xs font-semibold transition-all",
                  isSelected
                    ? cn(q.color, "ring-1 ring-accent")
                    : "border-border/60 bg-surface-2/40 text-muted hover:border-border hover:text-text",
                )}
              >
                <span>{q.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional Note / Dream / Context */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-accent" /> Note / Factors (Optional)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Woke up at 6am, drank magnesium, lucid dream..."
          className={inputCls}
        />
      </div>

      <FormFooter submitLabel="Save Sleep Record" />
    </form>
  );
}

export function SleepLoggerModal({ open, onClose, initialDate }: SleepLoggerModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Log & Edit Sleep Record" preventBackdropClose={true}>
      {open ? <SleepLoggerForm initialDate={initialDate} onClose={onClose} /> : null}
    </Modal>
  );
}
