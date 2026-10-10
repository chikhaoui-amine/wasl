"use client";

import { Check, Flame, ListTodo } from "lucide-react";
import { type Goal } from "@/lib/data/domains/goals";
import { PaceBar } from "@/components/goals/PaceBar";
import { goalPace, daysLeftLabel, paceToneClass } from "@/components/goals/pace";
import { cn } from "@/lib/utils";

interface GoalListRowProps {
  goal: Goal;
  northStarMeta?: { id: string; title: string; color?: string };
  showDirection?: boolean;
  linkedTaskCount?: number;
  onOpen: (goal: Goal) => void;
  onToggleDone?: (goal: Goal) => void;
  className?: string;
}

export function GoalListRow({
  goal,
  northStarMeta,
  showDirection = true,
  linkedTaskCount = 0,
  onOpen,
  onToggleDone,
  className,
}: GoalListRowProps) {
  const pace = goalPace(goal);
  const milestones = goal.milestones ?? [];
  const doneMilestones = milestones.filter((m) => m.done).length;
  const color = northStarMeta?.color || "var(--accent)";
  const isDone = pace.tone === "done";
  const left = daysLeftLabel(pace.daysLeft);
  const statusLabel = !isDone && goal.status && goal.status !== "active" ? goal.status : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open goal ${goal.title}`}
      onClick={() => onOpen(goal)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(goal);
        }
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 sm:px-3 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {onToggleDone ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(goal);
          }}
          aria-label={isDone ? "Reopen goal" : "Mark goal complete"}
          title={isDone ? "Reopen goal" : "Mark goal complete"}
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors active:scale-90",
            isDone
              ? "border-success bg-success text-bg"
              : "border-border-strong text-transparent hover:border-success hover:text-success",
          )}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </button>
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4
            className={cn(
              "truncate text-[13.5px] font-semibold tracking-tight text-text",
              isDone && "text-muted line-through decoration-faint",
            )}
          >
            {goal.title}
          </h4>
          {goal.isCurrentFocus && !isDone && <Flame className="h-3 w-3 shrink-0 text-warn" aria-label="Focus" />}
          {statusLabel && (
            <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted">
              {statusLabel}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-faint">
          {showDirection && northStarMeta?.title && (
            <>
              <span className="inline-flex items-center gap-1">
                {onToggleDone && (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                )}
                {northStarMeta.title}
              </span>
              <span>·</span>
            </>
          )}
          {milestones.length > 0 && (
            <span className="tabular-nums">
              {doneMilestones}/{milestones.length} milestones
            </span>
          )}
          {linkedTaskCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1">
              {milestones.length > 0 && <span className="mr-0.5">·</span>}
              <ListTodo className="h-3 w-3" /> {linkedTaskCount}
            </span>
          )}
          {milestones.length === 0 && linkedTaskCount === 0 && goal.why && (
            <span className="truncate">{goal.why}</span>
          )}
        </div>
      </div>

      <div className="hidden w-28 shrink-0 sm:block md:w-36">
        <PaceBar
          value={pace.progress}
          expected={isDone ? null : pace.elapsed}
          color={isDone ? "var(--success)" : color}
          size="sm"
          label={`${goal.title} progress`}
        />
      </div>

      <div className="w-[88px] shrink-0 text-right">
        <div className="font-mono text-[13px] font-semibold tabular-nums text-text">{pace.progress}%</div>
        <div className={cn("truncate text-[10.5px]", paceToneClass[pace.tone])}>
          {pace.tone === "on-pace" || pace.tone === "open" ? (left ?? pace.label) : pace.label}
        </div>
      </div>
    </div>
  );
}
