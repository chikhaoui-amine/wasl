import type { RecurringTask } from "./operations";
import type { Task, TaskInput } from "../tasks/operations";
import { isOccurrence } from "./operations";

/**
 * Deterministically generates an idempotent Task ID for a recurring task occurrence on a specific date.
 */
export function generateRecurringTaskId(recurringId: string, dateISO: string): string {
  return `rec-${recurringId}-${dateISO}`;
}

/**
 * Pure generator that calculates which tasks should exist for a given date based on recurring rules,
 * deduplicating against any existing tasks with the same deterministic ID.
 */
export function generateTasksForRecurringDate(
  recurringTasks: RecurringTask[],
  dateISO: string,
  existingTasks: Task[],
): TaskInput[] {
  const existingIds = new Set(existingTasks.map((t) => t.id));
  const newTasks: TaskInput[] = [];

  for (const rule of recurringTasks) {
    const id = generateRecurringTaskId(rule.id, dateISO);
    if (!existingIds.has(id) && isOccurrence(rule, dateISO)) {
      newTasks.push({
        title: rule.title,
        priority: "med",
        due: dateISO,
        today: true,
      });
    }
  }

  return newTasks;
}
