"use client";

import { Flame, ListTodo } from "lucide-react";
import {
  goalProgress,
  daysLeft,
  periodLabel,
  goalYearSpanLabel,
  type Goal,
} from "@/lib/data/domains/goals";
import { ProgressBar, Pill } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface GoalListRowProps {
  goal: Goal;
  northStarMeta?: { id: string; title: string; color?: string };
  linkedTaskCount?: number;
  onOpen: (goal: Goal) => void;
  className?: string;
}

export function GoalListRow({
  goal,
  northStarMeta,
  linkedTaskCount = 0,
  onOpen,
  className,
}: GoalListRowProps) {
  const progress = goalProgress(goal);
  const left = daysLeft(goal);
  const milestones = goal.milestones ?? [];
  const doneMilestones = milestones.filter((m) => m.done).length;
  const yearSpan = goalYearSpanLabel(goal);
  const nsColor = northStarMeta?.color || "#b57edc";

  return (
    <div
      onClick={() => onOpen(goal)}
      className={cn(
        "group flex cursor-pointer flex-col gap-2 rounded-xl border border-border/80 bg-surface/80 p-3 sm:px-4 sm:py-3 transition-all hover:border-border-strong hover:bg-surface hover:shadow-xs sm:flex-row sm:items-center sm:justify-between",
        goal.completed && "opacity-75 bg-surface-2/40",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {northStarMeta?.title && (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft/30 px-2 py-0.5 text-[10px] font-semibold text-accent border border-accent/20">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: nsColor }} />
              <span className="truncate max-w-[120px]">{northStarMeta.title}</span>
            </span>
          )}

          {yearSpan && (
            <span className="rounded-pill bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-muted border border-border/60">
              {yearSpan}
            </span>
          )}

          {goal.isCurrentFocus && !goal.completed && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-warn/15 px-2 py-0.5 text-[10px] font-bold text-warn border border-warn/30">
              <Flame className="h-3 w-3" /> Focus
            </span>
          )}

          <h4
            className={cn(
              "font-display text-[13.5px] sm:text-[14px] font-semibold leading-snug tracking-tight text-text group-hover:text-accent transition-colors",
              goal.completed && "text-faint line-through",
            )}
          >
            {goal.title}
          </h4>

          {goal.status && goal.status !== "active" && !goal.completed && (
            <span className="rounded-pill bg-surface-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              {goal.status}
            </span>
          )}
        </div>

        {goal.why && (
          <p className="text-[12px] text-muted line-clamp-1 leading-snug">{goal.why}</p>
        )}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto pt-1 sm:pt-0 border-t border-border/40 sm:border-0 shrink-0">
        {linkedTaskCount > 0 && (
          <span className="hidden md:flex items-center gap-1 text-[11px] text-accent font-medium">
            <ListTodo className="h-3 w-3" /> {linkedTaskCount}
          </span>
        )}

        <div className="w-24 sm:w-28 space-y-1 text-left sm:text-right">
          <div className="flex items-center justify-between text-[10.5px] sm:text-[11px]">
            <span className="text-faint">
              {milestones.length > 0 ? `${doneMilestones}/${milestones.length}` : "Progress"}
            </span>
            <span className="font-mono font-semibold text-text tabular-nums">{progress}%</span>
          </div>
          <ProgressBar value={progress} color="var(--accent)" />
        </div>

        <div className="flex flex-col items-end gap-1">
          {goal.completed ? (
            <Pill tone="success">Done</Pill>
          ) : (
            <Pill tone={left !== null && left <= 7 ? "warn" : "neutral"}>
              {left !== null ? `${left}d left` : periodLabel(goal)}
            </Pill>
          )}
        </div>
      </div>
    </div>
  );
}
