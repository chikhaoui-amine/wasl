"use client";

import { Trash2, Plus, Pencil } from "lucide-react";
import type { NorthStarPreset } from "@/lib/data/domains/goals";

export function NorthStarCard({
  preset,
  activeCount,
  onAddGoal,
  onEdit,
  onDelete,
  children,
}: {
  preset: NorthStarPreset & { isUserCreated?: boolean };
  activeCount: number;
  onAddGoal?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="group relative flex flex-col rounded-2xl border border-border/80 bg-surface/80 p-5 sm:p-6 transition-all duration-200 hover:border-border-strong hover:shadow-md space-y-3">
      {/* Header & Lifetime Vision */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {preset.color && (
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: preset.color }}
                aria-hidden="true"
              />
            )}
            <h3 className="font-display text-base sm:text-lg font-bold leading-snug tracking-tight text-text truncate">
              {preset.title}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted">
              {activeCount} {activeCount === 1 ? "goal" : "goals"}
            </span>

            {onAddGoal && (
              <button
                type="button"
                onClick={onAddGoal}
                className="flex items-center gap-1 rounded-full bg-accent-soft/40 px-2.5 py-0.5 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
                title={`Add goal to ${preset.title}`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Goal</span>
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title="Edit North Star"
                aria-label={`Edit North Star ${preset.title}`}
                className="p-1 sm:p-1.5 rounded-lg text-faint hover:text-text hover:bg-surface-2 opacity-70 group-hover:opacity-100 transition-all"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete North Star"
                aria-label={`Delete North Star ${preset.title}`}
                className="p-1 sm:p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger/10 opacity-70 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {preset.description && (
          <p className="text-xs sm:text-[13px] leading-relaxed text-muted line-clamp-2">
            {preset.description}
          </p>
        )}
      </div>

      {/* Nested Goals Container */}
      <div>
        {children}
      </div>
    </div>
  );
}
