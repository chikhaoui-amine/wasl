import { PaceBar } from "@/components/goals/PaceBar";
import { cn } from "@/lib/utils";

interface GoalYearPulseProps {
  year: number;
  /** Share of the selected year already elapsed (0–100). */
  yearElapsed: number;
  activeGoalsCount: number;
  averageProgress: number;
  onTrackCount: number;
  behindCount: number;
  completedCount: number;
  completedMilestones: number;
  totalMilestones: number;
  className?: string;
}

export function GoalYearPulse({
  year,
  yearElapsed,
  activeGoalsCount,
  averageProgress,
  onTrackCount,
  behindCount,
  completedCount,
  completedMilestones,
  totalMilestones,
  className,
}: GoalYearPulseProps) {
  const delta = averageProgress - yearElapsed;
  const inYear = yearElapsed > 0 && yearElapsed < 100;
  const verdict =
    activeGoalsCount === 0
      ? "Nothing in motion yet"
      : !inYear
        ? "average progress"
        : delta >= 0
          ? `Ahead of the calendar by ${delta}%`
          : delta > -8
            ? "Keeping pace with the year"
            : `${Math.abs(delta)}% behind the calendar`;

  const verdictTone =
    activeGoalsCount === 0 || !inYear
      ? "text-muted"
      : delta >= 0
        ? "text-success"
        : delta > -8
          ? "text-muted"
          : "text-warn";

  const stats = [
    { label: "Active", value: activeGoalsCount },
    { label: "On pace", value: onTrackCount, tone: onTrackCount > 0 ? "text-success" : undefined },
    { label: "Behind", value: behindCount, tone: behindCount > 0 ? "text-warn" : undefined },
    { label: "Done", value: completedCount },
    { label: "Milestones", value: `${completedMilestones}/${totalMilestones}` },
  ];

  return (
    <section aria-label={`${year} overview`} className={cn("card relative overflow-hidden p-4 sm:p-5", className)}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-10">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-4xl sm:text-5xl font-semibold tabular-nums tracking-tighter text-text">
              {averageProgress}
              <span className="text-2xl sm:text-3xl text-muted">%</span>
            </span>
            <span className={cn("text-[13px] font-medium", verdictTone)}>{verdict}</span>
          </div>

          <PaceBar
            value={averageProgress}
            expected={inYear ? yearElapsed : null}
            label={`${year} average goal progress`}
          />
          <div className="flex items-center justify-between text-[11px] tabular-nums text-faint">
            <span>Jan</span>
            {inYear && (
              <span>
                {yearElapsed}% of {year} gone
              </span>
            )}
            <span>Dec</span>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-5 sm:gap-6">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="truncate text-[10.5px] font-medium uppercase tracking-[0.1em] text-faint">{s.label}</dt>
              <dd className={cn("mt-1 font-display text-lg sm:text-xl font-semibold tabular-nums text-text", s.tone)}>
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
