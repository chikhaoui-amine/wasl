/**
 * packages/wasl-mcp-local/src/tool-definitions.ts
 *
 * Tool definitions and schemas for the Direct Local MCP bridge.
 */

import { z } from "zod";
import { canonicalToolName, describeCanonicalTool, MCP_OBSOLETE_TOOLS } from "./tool-catalog.js";

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
}

const ISO_DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("ISO day (YYYY-MM-DD)");
const PAGE_FIELDS = {
  limit: z.number().int().min(1).max(50).optional().describe("Page size (default 20, maximum 50)"),
  cursor: z.string().regex(/^\d+$/).optional().describe("Cursor returned by the previous page"),
};
const SEARCH_FIELDS = {
  query: z.string().trim().min(1).max(200).describe("Case-insensitive search text"),
  ...PAGE_FIELDS,
};
const DATE_FIELDS = { from: ISO_DAY.optional(), to: ISO_DAY.optional() };

const BASE_WASL_TOOLS: ToolDefinition[] = [
  {
    name: "mcp_capabilities",
    description: "Return safe permission and mutation-safety metadata for this Local MCP connection.",
    schema: z.object({}),
  },
  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------
  {
    name: "tasks_list",
    description: "List tasks from WASL Local with filters and bounded pagination.",
    schema: z.object({
      ...PAGE_FIELDS,
      due: ISO_DAY.optional(),
      today: z.boolean().optional().describe("Filter for today's tasks"),
      status: z.enum(["todo", "done"]).optional(),
      priority: z.enum(["low", "med", "high"]).optional().describe("Task priority filter"),
      goalId: z.string().optional(),
    }),
  },
  {
    name: "tasks_search",
    description: "Search task titles with filters and bounded pagination.",
    schema: z.object({
      ...SEARCH_FIELDS,
      due: ISO_DAY.optional(),
      today: z.boolean().optional(),
      status: z.enum(["todo", "done"]).optional(),
      priority: z.enum(["low", "med", "high"]).optional(),
      goalId: z.string().optional(),
    }),
  },
  {
    name: "tasks_get",
    description: "Get one task by exact ID.",
    schema: z.object({ id: z.string().min(1) }),
  },
  {
    name: "add_task",
    description: "Add a new task in WASL Local.",
    schema: z.object({
      title: z.string().describe("Task title"),
      priority: z.enum(["low", "med", "high"]).optional().describe("Priority level (default: med)"),
      due: ISO_DAY.optional(),
      today: z.boolean().optional().describe("Whether this task is scheduled for today (default: true)"),
      weekly: z.boolean().optional().describe("Whether this task is scheduled for this week"),
      goalId: z.string().optional().describe("Optional ID of the associated Goal"),
      idempotencyKey: z.string().optional().describe("Unique key to prevent duplicate creation on retries"),
    }),
  },
  {
    name: "update_task",
    description: "Update an existing task in WASL Local (complete, edit title/priority/due date).",
    schema: z.object({
      id: z.string().describe("Task ID to update"),
      title: z.string().optional().describe("New task title"),
      status: z.enum(["todo", "done"]).optional().describe("New status"),
      done: z.boolean().optional().describe("Convenience boolean to mark done/todo"),
      priority: z.enum(["low", "med", "high"]).optional().describe("New priority"),
      due: ISO_DAY.optional(),
      today: z.boolean().optional().describe("Move to / remove from today"),
      weekly: z.boolean().optional().describe("Weekly flag"),
    }),
  },
  {
    name: "delete_task",
    description: "Move a task to Trash in WASL Local (safe, recoverable).",
    schema: z.object({
      id: z.string().describe("Task ID to move to Trash"),
    }),
  },
  {
    name: "set_daily_focus",
    description: "Set the top 1-3 daily focus tasks for a given date in WASL Local.",
    schema: z.object({
      date: ISO_DAY.optional(),
      taskIds: z.array(z.string()).max(3).describe("Array of 1-3 Task IDs"),
    }),
  },

  // -------------------------------------------------------------------------
  // Notes
  // -------------------------------------------------------------------------
  {
    name: "notes_list",
    description: "List compact note summaries with filters and bounded pagination.",
    schema: z.object({
      ...PAGE_FIELDS,
      tag: z.string().optional().describe("Filter by category/tag name"),
      contentType: z.enum(["note", "read", "listen", "idea"]).optional(),
      pinned: z.boolean().optional(),
    }),
  },
  {
    name: "notes_search",
    description: "Search note titles, bodies, tags, and authors.",
    schema: z.object({
      ...SEARCH_FIELDS,
      tag: z.string().optional(),
      contentType: z.enum(["note", "read", "listen", "idea"]).optional(),
    }),
  },
  {
    name: "notes_get",
    description: "Get one complete note by exact ID.",
    schema: z.object({ id: z.string().min(1) }),
  },
  {
    name: "add_note",
    description: "Create a new note in WASL Local.",
    schema: z.object({
      title: z.string().optional().describe("Note title"),
      body: z.string().optional().describe("Markdown content"),
      tag: z.string().optional().describe("Category/Page name (e.g. 'work', 'ideas')"),
      contentType: z.enum(["note", "read", "listen", "idea"]).optional().describe("Note content type"),
      sourceUrl: z.string().optional().describe("Source URL if referencing an external article or video"),
      author: z.string().optional().describe("Author or speaker"),
      idempotencyKey: z.string().optional().describe("Idempotency key"),
    }),
  },
  {
    name: "update_note",
    description: "Update an existing note in WASL Local.",
    schema: z.object({
      id: z.string().describe("Note ID"),
      title: z.string().optional().describe("New title"),
      body: z.string().optional().describe("New markdown body"),
      tag: z.string().optional().describe("New tag/category"),
      pinned: z.boolean().optional().describe("Pin note to top"),
    }),
  },
  {
    name: "notes_append",
    description: "Atomically append markdown to an existing note by exact ID.",
    schema: z.object({
      id: z.string().min(1),
      body: z.string().min(1),
      separator: z.enum(["none", "newline", "blank_line"]).optional(),
    }),
  },
  {
    name: "delete_note",
    description: "Move a note to Trash in WASL Local.",
    schema: z.object({
      id: z.string().describe("Note ID to move to Trash"),
    }),
  },
  {
    name: "note_categories_list",
    description: "List note categories and their immutable IDs.",
    schema: z.object(PAGE_FIELDS),
  },
  {
    name: "note_categories_get",
    description: "Get one note category by immutable ID.",
    schema: z.object({ id: z.string().min(1) }),
  },
  {
    name: "add_note_category",
    description: "Create a custom note category in WASL Local.",
    schema: z.object({
      name: z.string().min(1),
      color: z.string().optional(),
      icon: z.string().optional(),
    }),
  },
  {
    name: "update_note_category",
    description: "Update a custom note category by immutable ID.",
    schema: z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
    }),
  },
  {
    name: "delete_note_category",
    description: "Delete a custom note category by immutable ID.",
    schema: z.object({ id: z.string().min(1) }),
  },

  // -------------------------------------------------------------------------
  // Goals
  // -------------------------------------------------------------------------
  {
    name: "goals_list",
    description: "List compact goal summaries with filters and pagination.",
    schema: z.object({
      ...PAGE_FIELDS,
      status: z.enum(["active", "paused", "completed", "later"]).optional(),
      category: z.string().optional().describe("Goal category"),
      type: z.enum(["north_star", "yearly_outcome", "monthly_outcome", "challenge"]).optional(),
      targetYear: z.number().int().min(2000).max(2200).optional(),
    }),
  },
  {
    name: "goals_search",
    description: "Search goals by title or category.",
    schema: z.object({
      ...SEARCH_FIELDS,
      status: z.enum(["active", "paused", "completed", "later"]).optional(),
      category: z.string().optional(),
      type: z.enum(["north_star", "yearly_outcome", "monthly_outcome", "challenge"]).optional(),
      targetYear: z.number().int().min(2000).max(2200).optional(),
    }),
  },
  {
    name: "goals_get",
    description: "Get one complete goal by exact ID.",
    schema: z.object({ id: z.string().min(1) }),
  },
  {
    name: "add_goal",
    description: "Create a new Goal in WASL Local.",
    schema: z.object({
      title: z.string().describe("Goal title"),
      category: z.string().optional().describe("Goal category / pillar"),
      targetDate: z.string().optional().describe("Target completion date (YYYY-MM-DD)"),
      description: z.string().optional().describe("Goal description or motivation"),
      idempotencyKey: z.string().optional(),
    }),
  },
  {
    name: "update_goal",
    description: "Update an existing Goal in WASL Local.",
    schema: z.object({
      id: z.string().describe("Goal ID"),
      title: z.string().optional(),
      status: z.enum(["active", "paused", "completed", "later"]).optional(),
      progress: z.number().min(0).max(100).optional().describe("Progress percentage (0-100)"),
      targetDate: z.string().optional(),
      description: z.string().optional(),
    }),
  },
  {
    name: "delete_goal",
    description: "Move a goal to Trash in WASL Local.",
    schema: z.object({
      id: z.string().describe("Goal ID to move to Trash"),
    }),
  },

  // -------------------------------------------------------------------------
  // Habits
  // -------------------------------------------------------------------------
  {
    name: "habits_list",
    description: "List compact habit summaries with pagination.",
    schema: z.object(PAGE_FIELDS),
  },
  {
    name: "habits_search",
    description: "Search habits by title.",
    schema: z.object(SEARCH_FIELDS),
  },
  {
    name: "habits_get",
    description: "Get one habit and an optionally date-filtered completion log.",
    schema: z.object({ id: z.string().min(1), ...DATE_FIELDS }),
  },
  {
    name: "add_habit",
    description: "Add a new habit in WASL Local.",
    schema: z.object({
      title: z.string().describe("Habit title"),
      category: z.string().optional().describe("Habit category"),
      targetPerWeek: z.number().min(1).max(7).optional().describe("Target completions per week (1-7, default 7)"),
      color: z.string().optional().describe("Hex color or color name"),
      icon: z.string().optional().describe("Icon name"),
      idempotencyKey: z.string().optional(),
    }),
  },
  {
    name: "update_habit",
    description: "Update an existing habit in WASL Local.",
    schema: z.object({
      id: z.string().describe("Habit ID"),
      title: z.string().optional(),
      category: z.string().optional().describe("Habit category; empty string clears it"),
      targetPerWeek: z.number().min(1).max(7).optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
    }),
  },
  {
    name: "set_habit_day_completed",
    description: "Explicitly set completion of a habit for a specific date in WASL Local.",
    schema: z.object({
      id: z.string().describe("Habit ID"),
      date: z.string().describe("ISO date (YYYY-MM-DD)"),
      completed: z.boolean().describe("Desired completion state"),
    }),
  },
  {
    name: "delete_habit",
    description: "Move a habit to Trash in WASL Local.",
    schema: z.object({
      id: z.string().describe("Habit ID to move to Trash"),
    }),
  },

  // -------------------------------------------------------------------------
  // Calendar Blocks
  // -------------------------------------------------------------------------
  {
    name: "calendar_list",
    description: "List calendar blocks using ISO days and HH:mm times.",
    schema: z.object({
      ...PAGE_FIELDS,
      date: ISO_DAY.optional(),
      ...DATE_FIELDS,
    }),
  },
  {
    name: "calendar_search",
    description: "Search calendar block titles with date filters.",
    schema: z.object({ ...SEARCH_FIELDS, date: ISO_DAY.optional(), ...DATE_FIELDS }),
  },
  {
    name: "calendar_get",
    description: "Get one calendar block by exact ID.",
    schema: z.object({ id: z.string().min(1) }),
  },
  {
    name: "add_calendar_block",
    description: "Add a calendar time-block in WASL Local.",
    schema: z.object({
      title: z.string().describe("Block title"),
      date: ISO_DAY,
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      category: z.string().optional().describe("Block category / color type"),
      taskId: z.string().optional().describe("Associated Task ID if linked to a task"),
      idempotencyKey: z.string().optional(),
    }),
  },
  {
    name: "delete_calendar_block",
    description: "Delete a calendar block in WASL Local.",
    schema: z.object({
      id: z.string().describe("Calendar block ID"),
    }),
  },

  // -------------------------------------------------------------------------
  // Sensitive Domains (Permission Gated)
  // -------------------------------------------------------------------------
  {
    name: "journal_list",
    description: "List compact journal summaries with mood/date filters (requires Journal permission).",
    schema: z.object({
      ...PAGE_FIELDS,
      ...DATE_FIELDS,
      mood: z.enum(["great", "good", "okay", "low", "rough"]).optional(),
    }),
  },
  {
    name: "journal_search",
    description: "Search journal bodies with bounded results (requires Journal permission).",
    schema: z.object({ ...SEARCH_FIELDS, ...DATE_FIELDS }),
  },
  {
    name: "journal_get",
    description: "Get one complete journal entry by exact ID (requires Journal permission).",
    schema: z.object({ id: z.string().min(1) }),
  },
  {
    name: "add_journal_entry",
    description: "Add a journal entry in WASL Local.",
    schema: z.object({
      date: ISO_DAY,
      body: z.string().min(1).describe("Markdown reflection text"),
      mood: z.enum(["great", "good", "okay", "low", "rough"]).optional(),
      idempotencyKey: z.string().optional(),
    }),
  },
  {
    name: "get_money",
    description: "Fetch finance accounts, savings, and transactions from WASL Local (requires Money permission).",
    schema: z.object({
      from: z.string().optional().describe("Start date"),
      to: z.string().optional().describe("End date"),
    }),
  },
  {
    name: "add_money_account",
    description: "Add a financial account or card in WASL Local.",
    schema: z.object({
      name: z.string(),
      type: z.enum(["bank", "card", "cash", "savings", "investment", "wallet"]),
      initialBalance: z.number().optional(),
      currency: z.string().optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
    }),
  },
  {
    name: "update_money_account",
    description: "Update a financial account or card in WASL Local.",
    schema: z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.enum(["bank", "card", "cash", "savings", "investment", "wallet"]).optional(),
      initialBalance: z.number().optional(),
      currency: z.string().optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
    }),
  },
  {
    name: "delete_money_account",
    description: "Delete a financial account or card in WASL Local.",
    schema: z.object({ id: z.string() }),
  },
  {
    name: "transactions_list",
    description: "List financial transactions with date/category/account filters.",
    schema: z.object({ ...PAGE_FIELDS, ...DATE_FIELDS, category: z.string().optional(), accountId: z.string().optional() }),
  },
  {
    name: "transactions_search",
    description: "Search transaction titles and categories.",
    schema: z.object({ ...SEARCH_FIELDS, ...DATE_FIELDS, category: z.string().optional(), accountId: z.string().optional() }),
  },
  {
    name: "transactions_get",
    description: "Get one financial transaction by exact ID.",
    schema: z.object({ id: z.string().min(1) }),
  },
  {
    name: "add_money_transaction",
    description: "Add a financial transaction in WASL Local.",
    schema: z.object({
      amount: z.number().describe("Transaction amount"),
      type: z.enum(["income", "expense", "transfer"]).describe("Transaction type"),
      category: z.string().describe("Transaction category"),
      date: ISO_DAY,
      title: z.string().optional(),
      accountId: z.string().optional(),
      transferAccountId: z.string().optional(),
      idempotencyKey: z.string().optional(),
    }),
  },
  {
    name: "get_health",
    description: "Fetch health & workout history from WASL Local (requires Health permission).",
    schema: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  },
  {
    name: "workouts_list",
    description: "List workout summaries with sport/date filters.",
    schema: z.object({ ...PAGE_FIELDS, ...DATE_FIELDS, sport: z.string().optional() }),
  },
  {
    name: "workouts_search",
    description: "Search workouts by sport or notes.",
    schema: z.object({ ...SEARCH_FIELDS, ...DATE_FIELDS, sport: z.string().optional() }),
  },
  {
    name: "workouts_get",
    description: "Get one complete workout by exact ID.",
    schema: z.object({ id: z.string().min(1) }),
  },
  {
    name: "log_workout",
    description: "Log a completed workout session in WASL Local.",
    schema: z.object({
      title: z.string().describe("Workout title"),
      date: ISO_DAY,
      durationMinutes: z.number().positive().optional(),
      notes: z.string().optional(),
      idempotencyKey: z.string().optional(),
    }),
  },
  {
    name: "update_health_day",
    description: "Update or clear daily health fields in WASL Local.",
    schema: z.object({
      date: ISO_DAY.optional(),
      steps: z.number().nullable().optional(),
      sleepH: z.number().nullable().optional(),
      waterCups: z.number().nullable().optional(),
      weightKg: z.number().nullable().optional(),
      soreness: z.number().nullable().optional(),
      energy: z.number().nullable().optional(),
      sleepQuality: z.string().nullable().optional(),
      sleepNote: z.string().nullable().optional(),
    }),
  },
  // -------------------------------------------------------------------------
  // Cross-Domain Search & Trash
  // -------------------------------------------------------------------------
  {
    name: "trash_list",
    description: "List compact Trash items with bounded pagination.",
    schema: z.object({
      ...PAGE_FIELDS,
    }),
  },
  {
    name: "trash_get",
    description: "Get one Trash item by exact ID.",
    schema: z.object({ id: z.string().min(1) }),
  },
  {
    name: "restore_trash_item",
    description: "Restore an item from Trash back to its active domain in WASL Local.",
    schema: z.object({
      id: z.string().describe("Trash item ID to restore"),
    }),
  },
  {
    name: "recurring_list",
    description: "List recurring task templates with pagination.",
    schema: z.object({ ...PAGE_FIELDS, frequency: z.enum(["daily", "weekly", "monthly", "custom"]).optional() }),
  },
  {
    name: "recurring_search",
    description: "Search recurring task templates by title.",
    schema: z.object({ ...SEARCH_FIELDS, frequency: z.enum(["daily", "weekly", "monthly", "custom"]).optional() }),
  },
  {
    name: "recurring_get",
    description: "Get one recurring task template by exact ID.",
    schema: z.object({ id: z.string().min(1) }),
  },
  {
    name: "add_recurring_task",
    description: "Create a recurring task series in WASL Local.",
    schema: z.object({
      title: z.string().min(1),
      frequency: z.enum(["daily", "weekly", "monthly", "custom"]),
      startDate: ISO_DAY.optional(),
      endDate: ISO_DAY.optional(),
      weekDays: z.array(z.number().int().min(0).max(6)).optional(),
      monthDay: z.number().int().min(1).max(31).optional(),
      intervalDays: z.number().int().positive().optional(),
    }),
  },
  {
    name: "update_recurring_task",
    description: "Update a recurring task series and remove fields that do not apply to its frequency.",
    schema: z.object({
      id: z.string().min(1),
      title: z.string().optional(),
      frequency: z.enum(["daily", "weekly", "monthly", "custom"]).optional(),
      startDate: ISO_DAY.optional(),
      endDate: ISO_DAY.optional(),
      weekDays: z.array(z.number().int().min(0).max(6)).optional(),
      monthDay: z.number().int().min(1).max(31).optional(),
      intervalDays: z.number().int().positive().optional(),
    }),
  },
  {
    name: "topics_list",
    description: "List learning topics without embedding roadmaps, resources, or notes.",
    schema: z.object(PAGE_FIELDS),
  },
  {
    name: "topics_search",
    description: "Search learning topics by title or description.",
    schema: z.object(SEARCH_FIELDS),
  },
  {
    name: "topics_get",
    description: "Get one complete learning topic by exact ID.",
    schema: z.object({ id: z.string().min(1) }),
  },
  {
    name: "add_topic_note",
    description: "Add a nested note to a learning topic in WASL Local.",
    schema: z.object({ topicId: z.string().min(1), title: z.string().optional(), text: z.string().min(1), pinned: z.boolean().optional(), contentType: z.enum(["note", "read", "listen", "idea"]).optional(), sourceUrl: z.string().optional(), author: z.string().optional() }),
  },
  {
    name: "update_topic_note",
    description: "Update a nested topic note by immutable IDs.",
    schema: z.object({ topicId: z.string().min(1), noteId: z.string().min(1), title: z.string().optional(), text: z.string().optional(), pinned: z.boolean().optional(), contentType: z.enum(["note", "read", "listen", "idea"]).optional(), sourceUrl: z.string().optional(), author: z.string().optional() }),
  },
  {
    name: "delete_topic_note",
    description: "Delete a nested topic note by immutable IDs.",
    schema: z.object({ topicId: z.string().min(1), noteId: z.string().min(1) }),
  },
  {
    name: "search_all",
    description: "Perform a unified search across tasks, notes, goals, and topics in WASL Local.",
    schema: z.object({
      query: z.string().describe("Search query term"),
      limit: z.number().max(30).optional().describe("Max items to return (default 20, max 30)"),
    }),
  },
];

function isWriteTool(toolName: string): boolean {
  return !(
    toolName === "mcp_capabilities" ||
    toolName.startsWith("get_") ||
    toolName.startsWith("list_") ||
    toolName.startsWith("search_") ||
    toolName.endsWith("_list") ||
    toolName.endsWith("_search") ||
    toolName.endsWith("_get")
  );
}

const MUTATION_SAFETY_FIELDS = {
  expectedVersion: z.string().datetime({ offset: true }).optional().describe("Optimistic concurrency token returned as version by the latest write or updatedAt by get/list"),
  idempotencyKey: z.string().trim().min(8).max(200).optional().describe("Stable retry key; reusing it with different arguments is rejected"),
  confirmation: z.string().optional().describe("Exact confirmation for permanent operations; entity deletes use DELETE:<immutable-id>"),
};

export const WASL_TOOLS: ToolDefinition[] = BASE_WASL_TOOLS.filter(
  (tool) => !MCP_OBSOLETE_TOOLS.has(tool.name),
).map((tool) => {
  const name = canonicalToolName(tool.name);
  const mutates = isWriteTool(name);
  const idFields = mutates
    ? Object.keys(tool.schema.shape).filter((key) =>
        (key === "id" || key.endsWith("Id") || key.endsWith("Ids")) &&
        !(tool.schema.shape[key] as z.ZodType).safeParse(undefined).success,
      )
    : [];
  return {
    ...tool,
    name,
    description: describeCanonicalTool({ name, description: tool.description, mutates, idFields }),
    schema: mutates ? tool.schema.extend(MUTATION_SAFETY_FIELDS) : tool.schema,
  };
});
