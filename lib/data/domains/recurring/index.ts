export {
  createDefaultRecurringState,
  normalizeRecurringTask,
  normalizeRecurringState,
  addRecurringOperation,
  updateRecurringOperation,
  toggleOccurrenceOperation,
  deleteRecurringOperation,
  isOccurrence,
  nextOccurrence,
  occurrencesInRange,
  ruleLabel,
  completionRate,
  recurringStreak,
  type RecurrenceFreq,
  type RecurrenceRule,
  type RecurringTask,
  type RecurringTaskInput,
} from "./operations";

export { generateRecurringTaskId, generateTasksForRecurringDate } from "./idempotency";
export { CURRENT_RECURRING_VERSION, migrateRecurringSnapshot } from "./migrations";
export { useRecurringData } from "./hooks";
