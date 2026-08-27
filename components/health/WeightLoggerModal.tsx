"use client";

import { useState } from "react";
import { Scale, Check, Calendar, Plus, Minus } from "lucide-react";
import { useHealthData, weightSeries } from "@/lib/data/domains/health";
import { Modal, FormFooter } from "@/components/ui/Modal";
import { addDays, relLabel, todayISO } from "@/lib/date";

interface WeightLoggerModalProps {
  open: boolean;
  onClose: () => void;
  initialDate?: string;
}

function WeightLoggerForm({
  initialDate,
  onClose,
}: {
  initialDate?: string;
  onClose: () => void;
}) {
  const { days, day, patchDay } = useHealthData();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayISO());

  const weights = weightSeries(days);
  const latestWeight = weights.at(-1)?.value || 70;

  const targetDay = day(selectedDate);
  const [weightKg, setWeightKg] = useState<string>(() =>
    targetDay.weightKg !== undefined && targetDay.weightKg > 0 ? String(targetDay.weightKg) : String(latestWeight),
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    const cur = day(newDate);
    setWeightKg(cur.weightKg !== undefined && cur.weightKg > 0 ? String(cur.weightKg) : String(latestWeight));
  };

  const handleAdjust = (delta: number) => {
    const current = Number(weightKg) || latestWeight || 70;
    const nextVal = Math.max(20, Math.min(300, current + delta));
    setWeightKg(nextVal.toFixed(1));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(weightKg);
    if (!num || num <= 0) return;

    patchDay(
      {
        weightKg: Number(num.toFixed(1)),
      },
      selectedDate,
    );

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 450);
  };

  const handleDelete = () => {
    patchDay(
      {
        weightKg: undefined,
      },
      selectedDate,
    );
    onClose();
  };

  const t = todayISO();
  const y = addDays(t, -1);
  const isLoggedForDay = targetDay.weightKg !== undefined && targetDay.weightKg > 0;

  if (savedSuccess) {
    return (
      <div className="py-8 text-center space-y-3">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 animate-bounce">
          <Check className="h-6 w-6 stroke-[3]" />
        </div>
        <h3 className="font-bold text-lg text-text">Weight Saved!</h3>
        <p className="text-xs text-muted">
          Recorded {weightKg} kg for {relLabel(selectedDate)}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Date Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-accent" /> Date of Weigh-in
          </span>
          <span className="text-[10px] text-accent font-semibold">{relLabel(selectedDate)}</span>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleDateChange(t)}
            className={`flex-1 rounded-xl py-1.5 text-xs font-semibold border transition ${
              selectedDate === t
                ? "border-accent bg-accent/15 text-accent"
                : "border-border/70 bg-surface-2/60 text-muted hover:text-text"
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => handleDateChange(y)}
            className={`flex-1 rounded-xl py-1.5 text-xs font-semibold border transition ${
              selectedDate === y
                ? "border-accent bg-accent/15 text-accent"
                : "border-border/70 bg-surface-2/60 text-muted hover:text-text"
            }`}
          >
            Yesterday
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && handleDateChange(e.target.value)}
            className="w-36 rounded-xl border border-border/70 bg-surface-2/60 px-2.5 py-1 text-xs text-text outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Weight Input with Stepper */}
      <div className="space-y-3 rounded-2xl border border-border/80 bg-surface-2/40 p-4 text-center">
        <div className="flex items-center justify-center gap-1 text-faint text-xs font-medium">
          <Scale className="h-4 w-4 text-accent" />
          <span>Scale Reading (kg)</span>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => handleAdjust(-0.5)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface-1 text-text hover:bg-surface-hover hover:border-accent/40 active:scale-95 transition"
            title="-0.5 kg"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleAdjust(-0.1)}
            className="rounded-lg border border-border/70 bg-surface-1 px-2 py-1 text-[11px] font-bold text-muted hover:text-text hover:border-accent/40 active:scale-95 transition"
            title="-0.1 kg"
          >
            -0.1
          </button>

          <div className="relative inline-block w-36">
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              autoFocus
              required
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full rounded-2xl border-2 border-accent/40 bg-surface-1 px-3 py-2.5 text-center font-display text-3xl font-bold tracking-tight text-text shadow-inner outline-none focus:border-accent"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-faint">
              kg
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleAdjust(0.1)}
            className="rounded-lg border border-border/70 bg-surface-1 px-2 py-1 text-[11px] font-bold text-muted hover:text-text hover:border-accent/40 active:scale-95 transition"
            title="+0.1 kg"
          >
            +0.1
          </button>
          <button
            type="button"
            onClick={() => handleAdjust(0.5)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface-1 text-text hover:bg-surface-hover hover:border-accent/40 active:scale-95 transition"
            title="+0.5 kg"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <FormFooter
        submitLabel="Save Weigh-in"
        disabled={!Number(weightKg) || Number(weightKg) <= 0}
        onDelete={isLoggedForDay ? handleDelete : undefined}
      />
    </form>
  );
}

export function WeightLoggerModal({ open, onClose, initialDate }: WeightLoggerModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Log & Track Bodyweight" preventBackdropClose={true}>
      {open && <WeightLoggerForm key={initialDate || "default"} initialDate={initialDate} onClose={onClose} />}
    </Modal>
  );
}
