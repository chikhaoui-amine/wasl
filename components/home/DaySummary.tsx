"use client";

import { useTasksData, type Task } from "@/lib/data/domains/tasks";
import { useHabitsData, type Habit } from "@/lib/data/domains/habits";
import { useBlocksData, type Block } from "@/lib/data/domains/blocks";

export interface DaySummaryParts {
  tasksLeft: number;
  overdue: number;
  habitsLeft: number;
  habitsTotal: number;
  /** The block happening now, or the next one later today. */
  nextBlock: { title: string; start: number; now: boolean } | null;
}

/** Same "belongs to today" rules as the TodayFocus and HabitsWidget cards. */
export function summarizeDay(
  tasks: Task[],
  habits: Habit[],
  blocks: Block[],
  date: string,
  nowHours: number,
): DaySummaryParts {
  let tasksLeft = 0;
  let overdue = 0;
  for (const t of tasks) {
    if (t.status === "done") continue;
    if (t.due && t.due < date) overdue++;
    else if (t.today || t.due === date) tasksLeft++;
  }

  const habitsLeft = habits.filter((h) => !h.log?.[date]).length;

  const today = blocks.filter((b) => b.date === date).sort((a, b) => a.start - b.start);
  const current = today.find((b) => b.start <= nowHours && b.end > nowHours);
  const upcoming = today.find((b) => b.start > nowHours);
  const pick = current ?? upcoming;

  return {
    tasksLeft,
    overdue,
    habitsLeft,
    habitsTotal: habits.length,
    nextBlock: pick ? { title: pick.title, start: pick.start, now: pick === current } : null,
  };
}

export function formatHour(decimal: number): string {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function daySummaryPhrases(s: DaySummaryParts): string[] {
  const out: string[] = [];
  if (s.tasksLeft > 0) out.push(`${s.tasksLeft} ${s.tasksLeft === 1 ? "task" : "tasks"} left`);
  if (s.overdue > 0) out.push(`${s.overdue} overdue`);
  if (s.habitsTotal > 0) {
    out.push(s.habitsLeft === 0 ? "All habits done" : `${s.habitsLeft} ${s.habitsLeft === 1 ? "habit" : "habits"} to go`);
  }
  if (s.nextBlock) {
    out.push(s.nextBlock.now ? `Now: ${s.nextBlock.title}` : `Next: ${s.nextBlock.title} at ${formatHour(s.nextBlock.start)}`);
  }
  if (out.length === 0) out.push("Nothing scheduled. A clear day.");
  return out;
}

export function DaySummary({ date }: { date: string }) {
  const { tasks } = useTasksData();
  const { habits } = useHabitsData();
  const { blocks } = useBlocksData();
  const now = new Date();
  const summary = summarizeDay(tasks, habits, blocks, date, now.getHours() + now.getMinutes() / 60);
  const phrases = daySummaryPhrases(summary);

  return (
    <p className="relative z-10 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] sm:text-[14px] text-muted">
      {phrases.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-faint">·</span>}
          <span className={p.endsWith("overdue") ? "font-medium text-danger" : undefined}>{p}</span>
        </span>
      ))}
    </p>
  );
}
