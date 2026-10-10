import { daysLeft, elapsedPct, goalProgress, trackState, type Goal } from "@/lib/data/domains/goals";

export type PaceTone = "done" | "ahead" | "on-pace" | "behind" | "open";

export interface GoalPace {
  progress: number;
  /** Share of the goal's time window already elapsed, or null for open-ended goals. */
  elapsed: number | null;
  /** progress − elapsed, in percentage points. Null when there is no time window. */
  delta: number | null;
  tone: PaceTone;
  label: string;
  daysLeft: number | null;
}

export function goalPace(goal: Goal): GoalPace {
  const progress = goalProgress(goal);
  const elapsed = elapsedPct(goal);
  const left = daysLeft(goal);
  const track = trackState(goal, progress);

  if (track === "done") {
    return { progress, elapsed, delta: null, tone: "done", label: "Completed", daysLeft: left };
  }
  if (elapsed === null) {
    return { progress, elapsed, delta: null, tone: "open", label: "No deadline", daysLeft: left };
  }

  const delta = progress - elapsed;
  if (track === "behind") {
    return { progress, elapsed, delta, tone: "behind", label: `${Math.abs(delta)}% behind pace`, daysLeft: left };
  }
  if (delta >= 10) {
    return { progress, elapsed, delta, tone: "ahead", label: `${delta}% ahead`, daysLeft: left };
  }
  return { progress, elapsed, delta, tone: "on-pace", label: "On pace", daysLeft: left };
}

export const paceToneClass: Record<PaceTone, string> = {
  done: "text-success",
  ahead: "text-success",
  "on-pace": "text-muted",
  behind: "text-warn",
  open: "text-faint",
};

export function daysLeftLabel(left: number | null): string | null {
  if (left === null) return null;
  if (left === 0) return "Due today";
  if (left === 1) return "1 day left";
  if (left > 60) return `${Math.round(left / 30)} months left`;
  return `${left} days left`;
}

/** Share of a calendar year that has elapsed today (0 for future years, 100 for past ones). */
export function yearElapsedPct(year: number, now = new Date()): number {
  if (year < now.getFullYear()) return 100;
  if (year > now.getFullYear()) return 0;
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  return Math.round(((now.getTime() - start) / (end - start)) * 100);
}
