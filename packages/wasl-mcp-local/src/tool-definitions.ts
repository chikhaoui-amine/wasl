/**
 * packages/wasl-mcp-local/src/tool-definitions.ts
 *
 * Tool definitions and schemas for the Direct Local MCP bridge.
 */

import { z } from "zod";

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
}

export const WASL_TOOLS: ToolDefinition[] = [
  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------
  {
    name: "get_tasks",
    description: "Fetch tasks from WASL Local with optional filtering by date, status, or priority.",
    schema: z.object({
      due: z.string().optional().describe("Filter by ISO date (YYYY-MM-DD)"),
      today: z.boolean().optional().describe("Filter for today's tasks"),
      status: z.enum(["todo", "done", "all"]).optional().describe("Task status filter (default: todo)"),
      priority: z.enum(["low", "med", "high"]).optional().describe("Task priority filter"),
      limit: z.number().max(50).optional().describe("Maximum number of tasks to return (default 20, max 50)"),
      cursor: z.string().optional().describe("Cursor for pagination"),
    }),
  },
  {
    name: "add_task",
    description: "Add a new task in WASL Local.",
    schema: z.object({
      title: z.string().describe("Task title"),
      priority: z.enum(["low", "med", "high"]).optional().describe("Priority level (default: med)"),
      due: z.string().optional().describe("Due date in ISO format (YYYY-MM-DD)"),
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
      due: z.string().optional().describe("New due date"),
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
      date: z.string().optional().describe("ISO date (YYYY-MM-DD), defaults to today"),
      taskIds: z.array(z.string()).max(3).describe("Array of 1-3 Task IDs"),
    }),
  },

  // -------------------------------------------------------------------------
  // Notes
  // -------------------------------------------------------------------------
  {
    name: "get_notes",
    description: "Fetch notes from WASL Local with optional category/tag filter and pagination.",
    schema: z.object({
      tag: z.string().optional().describe("Filter by category/tag name"),
      query: z.string().optional().describe("Search term in title or body"),
      limit: z.number().max(50).optional().describe("Max items (default 20, max 50)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    }),
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
    name: "delete_note",
    description: "Move a note to Trash in WASL Local.",
    schema: z.object({
      id: z.string().describe("Note ID to move to Trash"),
    }),
  },

  // -------------------------------------------------------------------------
  // Goals
  // -------------------------------------------------------------------------
  {
    name: "get_goals",
    description: "Fetch goals from WASL Local.",
    schema: z.object({
      status: z.enum(["active", "completed", "archived", "all"]).optional(),
      category: z.string().optional().describe("Goal category"),
    }),
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
      status: z.enum(["active", "completed", "archived"]).optional(),
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
    name: "get_habits",
    description: "Fetch habits and completion logs from WASL Local.",
    schema: z.object({}),
  },
  {
    name: "add_habit",
    description: "Add a new habit in WASL Local.",
    schema: z.object({
      name: z.string().describe("Habit name"),
      targetPerWeek: z.number().min(1).max(7).optional().describe("Target completions per week (1-7, default 7)"),
      color: z.string().optional().describe("Hex color or color name"),
      icon: z.string().optional().describe("Icon name"),
      idempotencyKey: z.string().optional(),
    }),
  },
  {
    name: "toggle_habit_day",
    description: "Toggle completion of a habit for a specific date in WASL Local.",
    schema: z.object({
      id: z.string().describe("Habit ID"),
      date: z.string().describe("ISO date (YYYY-MM-DD) to toggle"),
      completed: z.boolean().optional().describe("Explicit completion status. Toggles if omitted."),
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
    name: "get_calendar_blocks",
    description: "Fetch time-blocked calendar schedule from WASL Local.",
    schema: z.object({
      date: z.string().optional().describe("Specific date (YYYY-MM-DD)"),
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
    }),
  },
  {
    name: "add_calendar_block",
    description: "Add a calendar time-block in WASL Local.",
    schema: z.object({
      title: z.string().describe("Block title"),
      date: z.string().describe("ISO date (YYYY-MM-DD)"),
      startTime: z.string().describe("Start time (HH:mm format, 24h)"),
      endTime: z.string().describe("End time (HH:mm format, 24h)"),
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
    name: "get_journal",
    description: "Fetch journal entries from WASL Local (requires explicit Journal permission in Settings).",
    schema: z.object({
      from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      limit: z.number().max(30).optional(),
    }),
  },
  {
    name: "add_journal_entry",
    description: "Add a journal entry in WASL Local.",
    schema: z.object({
      date: z.string().describe("Date of the entry (YYYY-MM-DD)"),
      entry: z.string().describe("Markdown reflection text"),
      mood: z.string().optional().describe("Optional mood indicator"),
      idempotencyKey: z.string().optional(),
    }),
  },
  {
    name: "get_money",
    description: "Fetch finance accounts and transactions from WASL Local (requires Money permission).",
    schema: z.object({
      from: z.string().optional().describe("Start date"),
      to: z.string().optional().describe("End date"),
    }),
  },
  {
    name: "add_money_transaction",
    description: "Add a financial transaction in WASL Local.",
    schema: z.object({
      amount: z.number().describe("Transaction amount"),
      type: z.enum(["income", "expense", "transfer"]).describe("Transaction type"),
      category: z.string().describe("Transaction category"),
      date: z.string().describe("Transaction date (YYYY-MM-DD)"),
      description: z.string().optional(),
      accountId: z.string().optional(),
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
    name: "log_workout",
    description: "Log a completed workout session in WASL Local.",
    schema: z.object({
      title: z.string().describe("Workout title"),
      date: z.string().describe("Workout date (YYYY-MM-DD)"),
      durationMin: z.number().optional().describe("Duration in minutes"),
      notes: z.string().optional(),
      idempotencyKey: z.string().optional(),
    }),
  },
  // -------------------------------------------------------------------------
  // Cross-Domain Search & Trash
  // -------------------------------------------------------------------------
  {
    name: "get_trash_items",
    description: "View items currently in Trash in WASL Local.",
    schema: z.object({
      limit: z.number().max(50).optional(),
    }),
  },
  {
    name: "restore_trash_item",
    description: "Restore an item from Trash back to its active domain in WASL Local.",
    schema: z.object({
      id: z.string().describe("Trash item ID to restore"),
    }),
  },
  {
    name: "get_recurring_tasks",
    description: "Fetch recurring task templates in WASL Local.",
    schema: z.object({}),
  },
  {
    name: "get_topics",
    description: "Fetch learning topics and progress in WASL Local.",
    schema: z.object({}),
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
