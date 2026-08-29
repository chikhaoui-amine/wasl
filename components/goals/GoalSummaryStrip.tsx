"use client";

import { Target, CheckCircle2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface GoalSummaryStripProps {
  activeGoalsCount: number;
  averageProgress: number;
  completedMilestones: number;
  totalMilestones: number;
  className?: string;
}

export function GoalSummaryStrip({
  activeGoalsCount,
  averageProgress,
  completedMilestones,
  totalMilestones,
  className,
}: GoalSummaryStripProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-border/70 bg-surface-2/50 p-3 sm:p-4 backdrop-blur-xs",
        className,
      )}
    >
      {/* 1. Active Goals */}
      <div className="flex items-center gap-3 rounded-xl bg-surface/60 border border-border/40 p-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft/30 text-accent">
          <Target className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-lg font-bold tracking-tight text-text tabular-nums">
            {activeGoalsCount}
          </div>
          <div className="text-[11px] font-medium text-muted">Active Goals</div>
        </div>
      </div>

      {/* 2. Avg Completion */}
      <div className="flex items-center gap-3 rounded-xl bg-surface/60 border border-border/40 p-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft/30 text-accent">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-display text-lg font-bold tracking-tight text-text tabular-nums">
              {averageProgress}%
            </span>
          </div>
          <div className="text-[11px] font-medium text-muted">Avg Completion</div>
        </div>
      </div>

      {/* 3. Milestone Velocity */}
      <div className="flex items-center gap-3 rounded-xl bg-surface/60 border border-border/40 p-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-lg font-bold tracking-tight text-text tabular-nums">
            {completedMilestones} / {totalMilestones}
          </div>
          <div className="text-[11px] font-medium text-muted">Milestones Done</div>
        </div>
      </div>
    </div>
  );
}
