const RENAMED_TOOLS = {
  mcp_capabilities: "system_capabilities_get",
  get_sync_status: "sync_status_get",
  get_money: "money_overview_get",
  get_health: "health_overview_get",
  add_task: "tasks_create",
  update_task: "tasks_update",
  delete_task: "tasks_delete",
  set_daily_focus: "tasks_daily_focus_set",
  add_note: "notes_create",
  update_note: "notes_update",
  delete_note: "notes_delete",
  set_note_pinned: "notes_pinned_set",
  add_note_category: "note_categories_create",
  update_note_category: "note_categories_update",
  delete_note_category: "note_categories_delete",
  add_topic: "topics_create",
  update_topic: "topics_update",
  delete_topic: "topics_delete",
  add_topic_step: "topic_steps_create",
  update_topic_step: "topic_steps_update",
  delete_topic_step: "topic_steps_delete",
  set_topic_step_completed: "topic_steps_completed_set",
  add_topic_substep: "topic_substeps_create",
  update_topic_substep: "topic_substeps_update",
  delete_topic_substep: "topic_substeps_delete",
  set_topic_substep_completed: "topic_substeps_completed_set",
  add_topic_resource: "topic_resources_create",
  update_topic_resource: "topic_resources_update",
  delete_topic_resource: "topic_resources_delete",
  add_topic_note: "topic_notes_create",
  update_topic_note: "topic_notes_update",
  delete_topic_note: "topic_notes_delete",
  add_habit: "habits_create",
  update_habit: "habits_update",
  delete_habit: "habits_delete",
  set_habit_day_completed: "habits_day_completed_set",
  add_journal_entry: "journal_create",
  update_journal_entry: "journal_update",
  delete_journal_entry: "journal_delete",
  add_goal: "goals_create",
  update_goal: "goals_update",
  delete_goal: "goals_delete",
  add_goal_milestone: "goal_milestones_create",
  update_goal_milestone: "goal_milestones_update",
  delete_goal_milestone: "goal_milestones_delete",
  set_goal_milestone_completed: "goal_milestones_completed_set",
  reorder_goal_milestones: "goal_milestones_reorder",
  add_calendar_block: "calendar_create",
  update_calendar_block: "calendar_update",
  delete_calendar_block: "calendar_delete",
  log_sleep: "health_sleep_log",
  log_weight: "health_weight_log",
  log_workout: "workouts_create",
  update_health_day: "health_day_update",
  update_workout: "workouts_update",
  delete_workout: "workouts_delete",
  get_active_workout: "active_workout_get",
  start_active_workout: "active_workout_start",
  update_active_workout: "active_workout_update",
  finish_active_workout: "active_workout_finish",
  discard_active_workout: "active_workout_discard",
  add_exercise: "exercises_create",
  update_exercise: "exercises_update",
  delete_exercise: "exercises_delete",
  add_program: "programs_create",
  update_program: "programs_update",
  delete_program: "programs_delete",
  set_active_program: "programs_active_set",
  restore_default_programs: "programs_defaults_restore",
  add_money_account: "money_accounts_create",
  update_money_account: "money_accounts_update",
  delete_money_account: "money_accounts_delete",
  add_transaction: "transactions_create",
  add_money_transaction: "transactions_create",
  update_transaction: "transactions_update",
  delete_transaction: "transactions_delete",
  transfer_money: "transactions_transfer",
  set_money_currency: "money_currency_set",
  add_savings_goal: "savings_goals_create",
  update_savings_goal: "savings_goals_update",
  delete_savings_goal: "savings_goals_delete",
  add_recurring_task: "recurring_create",
  update_recurring_task: "recurring_update",
  delete_recurring_task: "recurring_delete",
  set_recurring_occurrence: "recurring_occurrence_completed_set",
  restore_trash_item: "trash_restore",
  delete_trash_item_permanently: "trash_delete_permanently",
  empty_trash: "trash_empty",
} as const;

export const MCP_DEPRECATED_TOOLS: Readonly<Record<string, string>> = {
  ...RENAMED_TOOLS,
  search_all: "Use the domain-specific notes_search, tasks_search, goals_search, and topics_search tools.",
};

export const MCP_OBSOLETE_TOOLS = new Set(["search_all"]);

const IMPLEMENTATION_BY_CANONICAL = Object.fromEntries(
  Object.entries(RENAMED_TOOLS).map(([implementation, canonical]) => [canonical, implementation]),
) as Record<string, string>;

export function canonicalToolName(implementationName: string): string {
  return RENAMED_TOOLS[implementationName as keyof typeof RENAMED_TOOLS] ?? implementationName;
}

export function implementationToolName(canonicalName: string): string {
  return IMPLEMENTATION_BY_CANONICAL[canonicalName] ?? canonicalName;
}

export function describeCanonicalTool(input: {
  name: string;
  description: string;
  mutates: boolean;
  idFields?: string[];
}): string {
  const ids = input.idFields?.length
    ? ` Requires immutable ${input.idFields.join(", ")}.`
    : input.mutates && input.name.endsWith("_create")
      ? " Creates a new entity and returns its immutable ID."
      : "";
  const safety = input.mutates
    ? " MUTATES DATA. Supports idempotencyKey and optimistic expectedVersion; permanent operations require confirmation."
    : " READ-ONLY. Does not mutate WASL data.";
  return `${input.description.trim()}${ids}${safety}`;
}
