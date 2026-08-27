"use client";

import { useState } from "react";
import { X, Trash2, Target } from "lucide-react";
import { useGoalsData, getNorthStarMeta, type Goal } from "@/lib/data/domains/goals";

interface MonthlyOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  outcomeToEdit?: Goal;
  defaultMonth?: string; // YYYY-MM
}

export function MonthlyOutcomeModal(props: MonthlyOutcomeModalProps) {
  if (!props.isOpen) return null;
  return <MonthlyOutcomeModalInner key={props.outcomeToEdit?.id ?? "new"} {...props} />;
}

function MonthlyOutcomeModalInner({
  onClose,
  outcomeToEdit,
  defaultMonth,
}: MonthlyOutcomeModalProps) {
  const { goals, addGoal, updateGoal, deleteGoal } = useGoalsData();

  const currentYear = new Date().getFullYear();
  const currentMonthISO = defaultMonth || `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  // Get active yearly outcomes to link to
  const yearlyGoals = goals.filter(
    (g) => (g.type === "yearly_outcome" || (!g.type && !g.northStarId)) && g.status !== "completed",
  );

  const [title, setTitle] = useState(outcomeToEdit?.title || "");
  const [why, setWhy] = useState(outcomeToEdit?.why || "");
  const [linkedOutcomeId, setLinkedOutcomeId] = useState(
    outcomeToEdit?.linkedOutcomeId || outcomeToEdit?.northStarId || yearlyGoals[0]?.id || "",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedYearlyGoal = goals.find((g) => g.id === linkedOutcomeId);
    const northStarId = selectedYearlyGoal?.northStarId || selectedYearlyGoal?.category;

    if (outcomeToEdit) {
      await updateGoal(outcomeToEdit.id, {
        title: title.trim(),
        why: why.trim(),
        linkedOutcomeId: linkedOutcomeId || undefined,
        northStarId: northStarId || undefined,
      });
    } else {
      await addGoal({
        title: title.trim(),
        why: why.trim(),
        type: "monthly_outcome",
        targetMonth: currentMonthISO,
        targetYear: currentYear,
        linkedOutcomeId: linkedOutcomeId || undefined,
        northStarId: northStarId || undefined,
        status: "active",
      });
    }

    onClose();
  };

  const handleDelete = async () => {
    if (outcomeToEdit) {
      try {
        await deleteGoal(outcomeToEdit.id);
        onClose();
      } catch (err) {
        console.error("Failed to delete monthly outcome:", err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-surface border border-border p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text">
                {outcomeToEdit ? "Edit Monthly Focus" : "New Monthly Focus"}
              </h3>
              <p className="text-xs text-faint">
                Bridge your yearly goal to weekly execution
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Outcome Title */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">
              Monthly Outcome Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Launch v1 Beta & Onboard 50 Users"
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none transition-all"
            />
          </div>

          {/* Linked Yearly Goal */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">
              Link to Yearly Goal (Optional)
            </label>
            <select
              value={linkedOutcomeId}
              onChange={(e) => setLinkedOutcomeId(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text focus:border-accent focus:outline-none transition-all"
            >
              <option value="">No Yearly Goal Link</option>
              {yearlyGoals.map((yg) => {
                const nsMeta = getNorthStarMeta(yg.northStarId || yg.category);
                return (
                  <option key={yg.id} value={yg.id}>
                    {yg.title} ({nsMeta.title})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Why / Reason */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">
              Why it Matters (Optional)
            </label>
            <textarea
              rows={2}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Key reason driving this month's outcome"
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            {outcomeToEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="btn-hero rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50 transition-all"
              >
                {outcomeToEdit ? "Save Changes" : "Create Focus"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
