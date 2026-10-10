import type { Priority, Task } from "@/lib/data/domains/tasks";

export type PlanBucket = "overdue" | "today" | "week" | "later" | "someday" | "done";

/**
 * Where an open task belongs in time. Every task lands in exactly one bucket,
 * so nothing can be created and then never shown.
 */
export function planBucket(t: Task, today: string, weekEnd: string): PlanBucket {
  if (t.status === "done") return "done";
  if (t.due && t.due < today) return "overdue";
  if (t.today || t.due === today) return "today";
  if (t.due && t.due <= weekEnd) return "week";
  if (t.weekly && !t.due) return "week";
  if (t.due) return "later";
  return "someday";
}

const priorityWeight: Record<Priority, number> = { high: 3, med: 2, low: 1 };
export const byPriority = (a: Task, b: Task) => (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
export const byDue = (a: Task, b: Task) => (a.due ?? "").localeCompare(b.due ?? "") || byPriority(a, b);

export interface TaskPlan {
  overdue: Task[];
  today: Task[];
  doneToday: Task[];
  /** This week after today, keyed by ISO day; tasks flagged weekly with no date go under "anytime". */
  week: { day: string; tasks: Task[] }[];
  weekAnytime: Task[];
  later: Task[];
  someday: Task[];
}

export function buildTaskPlan(tasks: Task[], today: string, weekDays: string[]): TaskPlan {
  const weekEnd = weekDays[weekDays.length - 1];
  const plan: TaskPlan = { overdue: [], today: [], doneToday: [], week: [], weekAnytime: [], later: [], someday: [] };
  const weekByDay = new Map<string, Task[]>();

  for (const t of tasks) {
    const b = planBucket(t, today, weekEnd);
    if (b === "done") {
      if (t.completedAt === today || (!t.completedAt && (t.today || t.due === today))) plan.doneToday.push(t);
    } else if (b === "week") {
      if (t.due) {
        const list = weekByDay.get(t.due) ?? [];
        list.push(t);
        weekByDay.set(t.due, list);
      } else {
        plan.weekAnytime.push(t);
      }
    } else {
      plan[b].push(t);
    }
  }

  plan.overdue.sort(byDue);
  plan.today.sort(byPriority);
  plan.later.sort(byDue);
  plan.someday.sort(byPriority);
  plan.weekAnytime.sort(byPriority);
  plan.week = weekDays
    .filter((d) => d > today)
    .map((day) => ({ day, tasks: (weekByDay.get(day) ?? []).sort(byPriority) }));
  return plan;
}

/**
 * Quick-add shorthand: "!" or "!high" marks high priority, "!low" low.
 * The markers are stripped from the title.
 */
export function parseQuickAdd(raw: string): { title: string; priority: Priority } {
  let priority: Priority = "med";
  const title = raw
    .replace(/(^|\s)!(high|low|!+)?(?=\s|$)/gi, (_m, lead: string, kind?: string) => {
      priority = kind?.toLowerCase() === "low" ? "low" : "high";
      return lead;
    })
    .replace(/\s+/g, " ")
    .trim();
  return { title, priority };
}
