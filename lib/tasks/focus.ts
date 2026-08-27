import type { Task } from "@/lib/data/domains/tasks";

export type DailyFocus = Record<string, string[]>;

const priorityWeight = { high: 0, med: 1, low: 2 } as const;

const urgencyBucket = (task: Task, date: string) => {
  if (task.due && task.due < date) return 0;
  if (task.due === date) return 1;
  if (task.priority === "high") return 2;
  if (task.today) return 3;
  return 4;
};

const compareDates = (a?: string, b?: string) =>
  (a ?? "9999-12-31").localeCompare(b ?? "9999-12-31");

export function rankFocusCandidates(tasks: Task[], date: string): Task[] {
  return tasks
    .filter((task) => task.status === "todo")
    .slice()
    .sort((a, b) => {
      const aBucket = urgencyBucket(a, date);
      const bBucket = urgencyBucket(b, date);
      const bucketDiff = aBucket - bBucket;
      if (bucketDiff) return bucketDiff;

      // For overdue work, age is the strongest urgency signal. Every other
      // bucket follows priority first, then its due date.
      if (aBucket === 0) {
        const dueDiff = compareDates(a.due, b.due);
        if (dueDiff) return dueDiff;
      }

      const priorityDiff = priorityWeight[a.priority] - priorityWeight[b.priority];
      if (priorityDiff) return priorityDiff;

      if (aBucket !== 0) {
        const dueDiff = compareDates(a.due, b.due);
        if (dueDiff) return dueDiff;
      }

      const createdDiff = a.createdAt.localeCompare(b.createdAt);
      return createdDiff || a.id.localeCompare(b.id);
    });
}

export function suggestDailyFocusIds(tasks: Task[], date: string, limit = 3): string[] {
  return rankFocusCandidates(tasks, date)
    .slice(0, Math.max(0, limit))
    .map((task) => task.id);
}

export function ensureDailyFocus(
  current: DailyFocus,
  tasks: Task[],
  date: string,
): DailyFocus {
  if (Object.prototype.hasOwnProperty.call(current, date)) return current;
  return { ...current, [date]: suggestDailyFocusIds(tasks, date) };
}

export function setDailyFocusSlot(
  current: DailyFocus,
  date: string,
  slot: number,
  taskId: string,
): DailyFocus {
  const selected = [...(current[date] ?? [])].filter((id) => id !== taskId);

  if (slot >= 0 && slot < selected.length) selected[slot] = taskId;
  else if (selected.length < 3) selected.push(taskId);

  return { ...current, [date]: selected.slice(0, 3) };
}

export function removeTaskFromDailyFocus(current: DailyFocus, taskId: string): DailyFocus {
  return Object.fromEntries(
    Object.entries(current).map(([date, taskIds]) => [
      date,
      taskIds.filter((id) => id !== taskId),
    ]),
  );
}
