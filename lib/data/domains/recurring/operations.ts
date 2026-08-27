import { addDays, fromISO, todayISO } from "@/lib/date";
import type { RecurringPersistedState } from "../../types";

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "custom";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** For weekly: 0=Mon..6=Sun. Multiple allowed, e.g. [0,2,4] = Mon/Wed/Fri */
  weekDays?: number[];
  /** For monthly: day of month 1..31 */
  monthDay?: number;
  /** For custom: every N days */
  intervalDays?: number;
}

export interface RecurringTask {
  id: string;
  title: string;
  rule: RecurrenceRule;
  /** ISO date when this series starts (first possible occurrence) */
  startDate: string;
  /** ISO date when this series ends (optional, undefined = forever) */
  endDate?: string;
  /** ISO dates that have been completed */
  completions: Record<string, boolean>;
  createdAt: string;
}

export interface RecurringTaskInput {
  title: string;
  rule: RecurrenceRule;
  startDate: string;
  endDate?: string;
}

export function createDefaultRecurringState(): RecurringPersistedState {
  const t = todayISO();
  return {
    recurring: [
      {
        id: "rec-sample-1",
        title: "Weekly Review & Goal Calibration",
        rule: { freq: "weekly", weekDays: [6] }, // Sunday
        startDate: t,
        completions: {},
        createdAt: t,
      },
      {
        id: "rec-sample-2",
        title: "Monthly Financial Audit & Budget Check",
        rule: { freq: "monthly", monthDay: 1 },
        startDate: t,
        completions: {},
        createdAt: t,
      },
    ],
  };
}

export function normalizeRecurringTask(raw: unknown): RecurringTask {
  if (!raw || typeof raw !== "object") {
    return {
      id: crypto.randomUUID(),
      title: "Untitled Recurring Task",
      rule: { freq: "daily" },
      startDate: todayISO(),
      completions: {},
      createdAt: todayISO(),
    };
  }

  const r = raw as Record<string, unknown>;
  const rawRule = (r.rule && typeof r.rule === "object" ? r.rule : {}) as Record<string, unknown>;
  const freq: RecurrenceFreq =
    rawRule.freq === "weekly" || rawRule.freq === "monthly" || rawRule.freq === "custom"
      ? rawRule.freq
      : "daily";

  const rule: RecurrenceRule = {
    freq,
    weekDays: Array.isArray(rawRule.weekDays)
      ? rawRule.weekDays.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6)
      : undefined,
    monthDay: typeof rawRule.monthDay === "number" ? rawRule.monthDay : undefined,
    intervalDays: typeof rawRule.intervalDays === "number" ? rawRule.intervalDays : undefined,
  };

  const completions: Record<string, boolean> = {};
  if (r.completions && typeof r.completions === "object" && !Array.isArray(r.completions)) {
    for (const [k, v] of Object.entries(r.completions)) {
      if (typeof v === "boolean" && v === true) {
        completions[k] = true;
      }
    }
  }

  return {
    id: typeof r.id === "string" && r.id ? r.id : crypto.randomUUID(),
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : "Untitled Recurring Task",
    rule,
    startDate: typeof r.startDate === "string" ? r.startDate : todayISO(),
    endDate: typeof r.endDate === "string" ? r.endDate : undefined,
    completions,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : todayISO(),
  };
}

export function normalizeRecurringState(raw: unknown): RecurringPersistedState {
  if (!raw || typeof raw !== "object") {
    return createDefaultRecurringState();
  }
  const state = raw as Record<string, unknown>;
  return {
    recurring: Array.isArray(state.recurring) ? state.recurring.map(normalizeRecurringTask) : [],
  };
}

export function addRecurringOperation(
  current: RecurringPersistedState,
  newTask: RecurringTask,
): RecurringPersistedState {
  return {
    ...current,
    recurring: [normalizeRecurringTask(newTask), ...current.recurring],
  };
}

export function updateRecurringOperation(
  current: RecurringPersistedState,
  id: string,
  patch: Partial<RecurringTaskInput>,
): RecurringPersistedState {
  return {
    ...current,
    recurring: current.recurring.map((r) => {
      if (r.id !== id) return r;
      return normalizeRecurringTask({
        ...r,
        ...patch,
        rule: patch.rule ?? r.rule,
      });
    }),
  };
}

export function toggleOccurrenceOperation(
  current: RecurringPersistedState,
  id: string,
  iso: string,
): RecurringPersistedState {
  return {
    ...current,
    recurring: current.recurring.map((r) => {
      if (r.id !== id) return r;
      const completions = { ...r.completions };
      if (completions[iso]) {
        delete completions[iso];
      } else {
        completions[iso] = true;
      }
      return { ...r, completions };
    }),
  };
}

export function deleteRecurringOperation(
  current: RecurringPersistedState,
  id: string,
): RecurringPersistedState {
  return {
    ...current,
    recurring: current.recurring.filter((r) => r.id !== id),
  };
}

/* ---------- Occurrence Engine ---------- */

/** Is `iso` a scheduled occurrence for this recurring task? */
export function isOccurrence(task: RecurringTask, iso: string): boolean {
  if (iso < task.startDate) return false;
  if (task.endDate && iso > task.endDate) return false;

  const { freq, weekDays, monthDay, intervalDays } = task.rule;
  const d = fromISO(iso);

  switch (freq) {
    case "daily":
      return true;
    case "weekly": {
      // JS: 0=Sun..6=Sat → convert to 0=Mon..6=Sun
      const jsDay = d.getDay();
      const moDay = jsDay === 0 ? 6 : jsDay - 1;
      return weekDays?.includes(moDay) ?? false;
    }
    case "monthly":
      return d.getDate() === (monthDay ?? 1);
    case "custom": {
      const start = fromISO(task.startDate);
      const diffMs = d.getTime() - start.getTime();
      const diffDays = Math.round(diffMs / 86_400_000);
      return diffDays >= 0 && diffDays % (intervalDays ?? 1) === 0;
    }
    default:
      return false;
  }
}

/** Get the next occurrence on or after `fromIso` (within 90 days). */
export function nextOccurrence(task: RecurringTask, fromIso: string): string | null {
  let cursor = fromIso < task.startDate ? task.startDate : fromIso;
  for (let i = 0; i < 90; i++) {
    if (task.endDate && cursor > task.endDate) return null;
    if (isOccurrence(task, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return null;
}

/** Get all occurrences in a date range [from, to] inclusive. */
export function occurrencesInRange(
  task: RecurringTask,
  from: string,
  to: string,
): string[] {
  const results: string[] = [];
  let cursor = from < task.startDate ? task.startDate : from;
  while (cursor <= to) {
    if (task.endDate && cursor > task.endDate) break;
    if (isOccurrence(task, cursor)) results.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return results;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Human-readable summary of the recurrence rule. */
export function ruleLabel(rule: RecurrenceRule): string {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  switch (rule.freq) {
    case "daily":
      return "Every day";
    case "weekly":
      if (rule.weekDays?.length === 7) return "Every day";
      if (rule.weekDays?.length === 5 && !rule.weekDays.includes(5) && !rule.weekDays.includes(6))
        return "Weekdays";
      return rule.weekDays?.map((d) => dayNames[d]).join(", ") ?? "Weekly";
    case "monthly":
      return `Monthly on the ${ordinal(rule.monthDay ?? 1)}`;
    case "custom":
      return `Every ${rule.intervalDays ?? 1} days`;
    default:
      return "Recurring";
  }
}

/** How many completions in the last N days? */
export function completionRate(task: RecurringTask, days = 30): number {
  const t = todayISO();
  const from = addDays(t, -(days - 1));
  const scheduled = occurrencesInRange(task, from, t);
  if (scheduled.length === 0) return 100;
  const done = scheduled.filter((iso) => task.completions[iso]).length;
  return Math.round((done / scheduled.length) * 100);
}

/** Current streak of consecutive completed occurrences ending today (or yesterday). */
export function recurringStreak(task: RecurringTask): number {
  let streak = 0;
  let cursor = todayISO();
  // If today is an occurrence and not done, start from yesterday
  if (isOccurrence(task, cursor) && !task.completions[cursor]) {
    cursor = addDays(cursor, -1);
  }
  for (let i = 0; i < 365; i++) {
    if (!isOccurrence(task, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (task.completions[cursor]) {
      streak++;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}
