"use client";

import { Check, Flame, ListTodo } from "lucide-react";
import {
  goalProgress,
  daysLeft,
  periodLabel,
  goalYearSpanLabel,
  trackState,
  type Goal,
} from "@/lib/data/domains/goals";
import { ProgressBar, Pill } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface GoalCardProps {
  goal: Goal;
  northStarMeta?: { id: string; title: string; color?: string };
  linkedTaskCount?: number;
  onOpen: (goal: Goal) => void;
  onToggleMilestone: (goalId: string, milestoneId: string) => void;
  className?: string;
}

export function GoalCard({
  goal,
  northStarMeta,
  linkedTaskCount = 0,
  onOpen,
  onToggleMilestone,
  className,
}: GoalCardProps) {
  const progress = goalProgress(goal);
  const left = daysLeft(goal);
  const track = trackState(goal, progress);
  const milestones = goal.milestones ?? [];
  const doneMilestones = milestones.filter((m) => m.done).length;
  const yearSpan = goalYearSpanLabel(goal);
  const nsColor = northStarMeta?.color || "#b57edc";

  return (
    <div
      onClick={() => onOpen(goal)}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/80 p-4 sm:p-5 transition-all duration-200 hover:border-border-strong hover:bg-surface hover:shadow-md cursor-pointer space-y-3.5",
        goal.completed && "opacity-75 bg-surface-2/40",
        className,
      )}
    >
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {northStarMeta?.title && (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft/30 px-2 py-0.5 text-[10.5px] font-semibold text-accent border border-accent/20">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: nsColor }} />
              <span className="truncate max-w-[120px] sm:max-w-[160px]">{northStarMeta.title}</span>
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
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {goal.completed ? (
            <Pill tone="success">Completed</Pill>
          ) : goal.status && goal.status !== "active" ? (
            <span className="rounded-pill bg-surface-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              {goal.status}
            </span>
          ) : (
            <div className="flex items-center gap-1">
              {track === "behind" && <Pill tone="warn">behind</Pill>}
              <Pill tone={left !== null && left <= 7 ? "warn" : "neutral"}>
                {left !== null ? `${left}d left` : periodLabel(goal)}
              </Pill>
            </div>
          )}
        </div>
      </div>

      {/* Main Title & Why */}
      <div className="space-y-1">
        <h3
          className={cn(
            "font-display text-base font-bold leading-snug tracking-tight text-text group-hover:text-accent transition-colors",
            goal.completed && "text-muted line-through",
          )}
        >
          {goal.title}
        </h3>
        {goal.why && (
          <p className="text-xs text-muted line-clamp-2 leading-relaxed">
            {goal.why}
          </p>
        )}
      </div>

      {/* Interactive Milestones List */}
      {milestones.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-border/50 bg-surface-2/50 p-2.5 sm:p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-faint">
            Milestones ({doneMilestones}/{milestones.length})
          </div>
          <div className="space-y-1">
            {milestones.slice(0, 3).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMilestone(goal.id, m.id);
                }}
                className="group/m flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-surface-3/80"
              >
                <span
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-all",
                    m.done
                      ? "border-success bg-success text-bg shadow-xs"
                      : "border-border-strong text-transparent group-hover/m:border-accent",
                  )}
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
                <span
                  className={cn(
                    "truncate flex-1 font-medium",
                    m.done ? "text-faint line-through" : "text-text",
                  )}
                >
                  {m.title}
                </span>
              </button>
            ))}
            {milestones.length > 3 && (
              <div className="pt-0.5 text-center text-[10.5px] font-medium text-accent">
                +{milestones.length - 3} more milestones
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Progress & Stats */}
      <div className="space-y-2 pt-1 border-t border-border/40">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-faint">
            {milestones.length > 0 ? (
              <span>{doneMilestones}/{milestones.length} done</span>
            ) : (
              <span>Progress</span>
            )}
            {linkedTaskCount > 0 && (
              <span className="flex items-center gap-1 text-accent font-medium">
                <ListTodo className="h-3 w-3" /> {linkedTaskCount} tasks
              </span>
            )}
          </div>
          <span className="font-mono font-bold text-text tabular-nums">{progress}%</span>
        </div>
        <ProgressBar value={progress} color="var(--accent)" />
      </div>
    </div>
  );
}
