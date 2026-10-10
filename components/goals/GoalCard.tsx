"use client";

import { Check, CircleCheck, Flame, ListTodo, RotateCcw } from "lucide-react";
import { goalYearSpanLabel, nextMilestone, type Goal } from "@/lib/data/domains/goals";
import { PaceBar } from "@/components/goals/PaceBar";
import { goalPace, daysLeftLabel, paceToneClass } from "@/components/goals/pace";
import { cn } from "@/lib/utils";

interface GoalCardProps {
  goal: Goal;
  northStarMeta?: { id: string; title: string; color?: string };
  /** Hide the direction label when the card already sits under its direction heading. */
  showDirection?: boolean;
  linkedTaskCount?: number;
  onOpen: (goal: Goal) => void;
  onToggleMilestone: (goalId: string, milestoneId: string) => void;
  onToggleFocus?: (goal: Goal) => void;
  onToggleDone?: (goal: Goal) => void;
  className?: string;
}

export function GoalCard({
  goal,
  northStarMeta,
  showDirection = true,
  linkedTaskCount = 0,
  onOpen,
  onToggleMilestone,
  onToggleFocus,
  onToggleDone,
  className,
}: GoalCardProps) {
  const pace = goalPace(goal);
  const milestones = goal.milestones ?? [];
  const doneMilestones = milestones.filter((m) => m.done).length;
  const next = nextMilestone(goal);
  const yearSpan = goalYearSpanLabel(goal);
  const color = northStarMeta?.color || "var(--accent)";
  const left = daysLeftLabel(pace.daysLeft);
  const isDone = pace.tone === "done";
  const isFocus = goal.isCurrentFocus && !isDone;

  return (
    <article
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
        "card card-hover group relative flex cursor-pointer flex-col gap-4 overflow-hidden p-4 sm:p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDone && "opacity-80",
        className,
      )}
    >
      {/* Direction hairline */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-70"
        style={{ background: `linear-gradient(90deg, ${color}, transparent 70%)` }}
      />

      {/* Meta row */}
      <div className="flex min-h-7 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-muted">
          {showDirection && northStarMeta?.title && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="truncate max-w-[160px]">{northStarMeta.title}</span>
            </span>
          )}
          {showDirection && northStarMeta?.title && yearSpan && <span className="text-faint">·</span>}
          {yearSpan && <span className="tabular-nums text-faint">{yearSpan}</span>}
          {isFocus && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-warn/12 px-1.5 py-0.5 text-[10.5px] font-semibold text-warn">
              <Flame className="h-3 w-3" /> Focus
            </span>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {onToggleFocus && !isDone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFocus(goal);
              }}
              aria-pressed={!!goal.isCurrentFocus}
              aria-label={goal.isCurrentFocus ? "Remove from focus" : "Add to focus"}
              title={goal.isCurrentFocus ? "Remove from focus" : "Add to focus"}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-surface-2 active:scale-95",
                goal.isCurrentFocus ? "text-warn" : "text-faint hover:text-text",
              )}
            >
              <Flame className="h-3.5 w-3.5" />
            </button>
          )}
          {onToggleDone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleDone(goal);
              }}
              aria-label={isDone ? "Reopen goal" : "Mark goal complete"}
              title={isDone ? "Reopen goal" : "Mark goal complete"}
              className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-success active:scale-95"
            >
              {isDone ? <RotateCcw className="h-3.5 w-3.5" /> : <CircleCheck className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Title & why */}
      <div className="-mt-2 space-y-1.5">
        <h3
          className={cn(
            "font-display text-[16px] sm:text-[17px] font-semibold leading-snug tracking-tight text-text [text-wrap:balance]",
            isDone && "text-muted line-through decoration-faint",
          )}
        >
          {goal.title}
        </h3>
        {goal.why && (
          <p className="max-w-[60ch] text-[12.5px] leading-relaxed text-muted line-clamp-2">{goal.why}</p>
        )}
      </div>

      {/* Next milestone — one tap to tick it off */}
      {next && !isDone && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMilestone(goal.id, next.id);
          }}
          title="Mark milestone done"
          className="group/m -mx-1 flex items-center gap-2.5 rounded-xl bg-surface-2/60 px-2.5 py-2 text-left transition-colors hover:bg-surface-2 active:scale-[0.99]"
        >
          <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border border-border-strong text-transparent transition-colors group-hover/m:border-success group-hover/m:text-success">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Next up</span>
            <span className="block truncate text-[12.5px] font-medium text-text">{next.title}</span>
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-faint">
            {doneMilestones}/{milestones.length}
          </span>
        </button>
      )}

      {/* Progress vs pace */}
      <div className="mt-auto space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold tabular-nums tracking-tight text-text">
              {pace.progress}%
            </span>
            <span className={cn("text-[11.5px] font-medium", paceToneClass[pace.tone])}>{pace.label}</span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px] text-faint">
            {linkedTaskCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListTodo className="h-3 w-3" /> {linkedTaskCount} {linkedTaskCount === 1 ? "task" : "tasks"}
              </span>
            )}
            {!isDone && left && <span className="tabular-nums">{left}</span>}
          </div>
        </div>
        <PaceBar
          value={pace.progress}
          expected={isDone ? null : pace.elapsed}
          color={isDone ? "var(--success)" : color}
          label={`${goal.title} progress`}
        />
        {milestones.length > 0 && (isDone || !next) && (
          <div className="text-[11px] tabular-nums text-faint">
            {doneMilestones}/{milestones.length} milestones
          </div>
        )}
      </div>
    </article>
  );
}
