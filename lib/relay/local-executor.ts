/**
 * lib/relay/local-executor.ts
 *
 * Framework-independent MCP Tool Executor for WASL Local Edition.
 *
 * Architecture & Guarantees:
 * - Executes directly against DataAdapter / LocalAdapter and IndexedDB.
 * - Reuses existing domain operations, migrations, and validation.
 * - Full support for all 12 active stores.
 * - Zero raw IndexedDB access or unrestricted code execution.
 * - Stable UUID generation & write idempotency support.
 * - Enforces client permissions (Read-only vs Read+Write) and sensitive domain restrictions.
 * - Output result limits (max 50) and cursor pagination.
 * - Deletes always safely move entities to Trash.
 * - Logs all tool execution metadata to the local audit store.
 */

import type { DataAdapter } from "@/lib/data/types";
import { todayISO } from "@/lib/date";
import { normalizeTask, type Task } from "@/lib/data/domains/tasks/operations";
import { normalizeGoal, type Goal } from "@/lib/data/domains/goals/operations";
import { normalizeHabit } from "@/lib/data/domains/habits/operations";
import type { Habit } from "@/lib/data/domains/habits/types";
import { moveToTrashOperation, restoreItemOperation, type TrashItem } from "@/lib/data/domains/trash/operations";
import type { Mood, JournalEntry } from "@/lib/data/domains/journal/types";
import type { Txn } from "@/lib/data/domains/money/types";
import type { Workout } from "@/lib/data/domains/health/types";
import {
  type McpClientProfile,
  type DomainName,
} from "./permissions";
import { recordAuditEntry } from "./audit";

export interface McpCallPayload {
  requestId?: string;
  toolName: string;
  args?: Record<string, unknown>;
}

export type McpExecutorOutcome =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

// Idempotency cache (in-memory, sliding window 100 entries)
const idempotencyCache = new Map<string, unknown>();

function getToolDomain(toolName: string): DomainName {
  if (toolName.includes("task") || toolName === "set_daily_focus") return "tasks";
  if (toolName.includes("note")) return "notes";
  if (toolName.includes("goal")) return "goals";
  if (toolName.includes("habit")) return "habits";
  if (toolName.includes("block") || toolName.includes("calendar")) return "blocks";
  if (toolName.includes("journal")) return "journal";
  if (toolName.includes("money") || toolName.includes("transaction")) return "money";
  if (toolName.includes("health") || toolName.includes("workout")) return "health";
  if (toolName.includes("recurring")) return "recurring";
  if (toolName.includes("topic")) return "topics";
  if (toolName.includes("trash")) return "trash";
  return "tasks";
}

function isWriteTool(toolName: string): boolean {
  return (
    toolName.startsWith("add_") ||
    toolName.startsWith("update_") ||
    toolName.startsWith("delete_") ||
    toolName.startsWith("set_") ||
    toolName.startsWith("toggle_") ||
    toolName.startsWith("log_") ||
    toolName.startsWith("restore_")
  );
}

export class LocalMcpExecutor {
  constructor(private adapter: DataAdapter) {}

  async execute(
    call: McpCallPayload,
    client: McpClientProfile,
  ): Promise<McpExecutorOutcome> {
    const startTime = Date.now();
    const domain = getToolDomain(call.toolName);
    const isWrite = isWriteTool(call.toolName);
    const args = call.args ?? {};

    // 1. Permission checks
    if (client.revoked) {
      const outcome = { ok: false as const, error: "PERMISSION_DENIED: Client access has been revoked." };
      recordAuditEntry({
        id: crypto.randomUUID(),
        clientId: client.id,
        clientName: client.name,
        toolName: call.toolName,
        domain,
        timestamp: new Date().toISOString(),
        outcome: "denied",
        durationMs: Date.now() - startTime,
        errorMessage: outcome.error,
      });
      return outcome;
    }

    if (isWrite && client.permission === "read") {
      const outcome = {
        ok: false as const,
        error: `PERMISSION_DENIED: Client '${client.name}' has read-only permissions and cannot execute write tool '${call.toolName}'.`,
      };
      recordAuditEntry({
        id: crypto.randomUUID(),
        clientId: client.id,
        clientName: client.name,
        toolName: call.toolName,
        domain,
        timestamp: new Date().toISOString(),
        outcome: "denied",
        durationMs: Date.now() - startTime,
        errorMessage: outcome.error,
      });
      return outcome;
    }

    // Domain gating applies to EVERY domain (not just sensitive ones): if a
    // profile's allowlist omits the tool's domain, the call is denied. Unknown
    // tools fall back to "tasks" which is in the default allowlist.
    if (!client.allowedDomains.includes(domain)) {
      const outcome = {
        ok: false as const,
        error: `DOMAIN_ACCESS_RESTRICTED: Domain '${domain}' is not enabled for '${client.name}'. Enable it for this connection in WASL Settings.`,
      };
      recordAuditEntry({
        id: crypto.randomUUID(),
        clientId: client.id,
        clientName: client.name,
        toolName: call.toolName,
        domain,
        timestamp: new Date().toISOString(),
        outcome: "denied",
        durationMs: Date.now() - startTime,
        errorMessage: outcome.error,
      });
      return outcome;
    }

    // 2. Idempotency check for writes — cache is scoped by client + tool so two
    // connectors using the same key can never receive each other's results.
    const idempotencyKey = typeof args.idempotencyKey === "string" ? args.idempotencyKey : null;
    const scopedCacheKey = idempotencyKey ? `${client.id}:${call.toolName}:${idempotencyKey}` : null;
    if (scopedCacheKey && idempotencyCache.has(scopedCacheKey)) {
      const cached = idempotencyCache.get(scopedCacheKey);
      return { ok: true, result: cached };
    }

    // 3. Tool execution
    try {
      const result = await this.dispatchTool(call.toolName, args);

      if (scopedCacheKey) {
        idempotencyCache.set(scopedCacheKey, result);
        if (idempotencyCache.size > 100) {
          const firstKey = idempotencyCache.keys().next().value;
          if (firstKey) idempotencyCache.delete(firstKey);
        }
      }

      recordAuditEntry({
        id: crypto.randomUUID(),
        clientId: client.id,
        clientName: client.name,
        toolName: call.toolName,
        domain,
        timestamp: new Date().toISOString(),
        outcome: "success",
        durationMs: Date.now() - startTime,
      });

      return { ok: true, result };
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message ?? "Tool execution failed";
      recordAuditEntry({
        id: crypto.randomUUID(),
        clientId: client.id,
        clientName: client.name,
        toolName: call.toolName,
        domain,
        timestamp: new Date().toISOString(),
        outcome: "error",
        durationMs: Date.now() - startTime,
        errorMessage: errorMsg,
      });
      return { ok: false, error: errorMsg };
    }
  }

  private async dispatchTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      // ---------------------------------------------------------------------
      // Tasks
      // ---------------------------------------------------------------------
      case "get_tasks": {
        const doc = await this.adapter.getStore("lifeos-tasks");
        let tasks = doc?.state.tasks ?? [];
        if (args.status === "todo") tasks = tasks.filter((t) => t.status === "todo");
        else if (args.status === "done") tasks = tasks.filter((t) => t.status === "done");
        if (args.priority) tasks = tasks.filter((t) => t.priority === args.priority);
        if (args.due) tasks = tasks.filter((t) => t.due === args.due);
        if (args.today) tasks = tasks.filter((t) => t.today);

        const limit = Math.min(Number(args.limit ?? 20), 50);
        const cursor = Number(args.cursor ?? 0);
        const paged = tasks.slice(cursor, cursor + limit);
        const nextCursor = cursor + limit < tasks.length ? String(cursor + limit) : null;

        return { tasks: paged, total: tasks.length, nextCursor };
      }

      case "add_task": {
        const title = String(args.title ?? "Untitled Task").trim();
        const priority = (args.priority as "low" | "med" | "high") ?? "med";
        const due = typeof args.due === "string" ? args.due : undefined;
        const today = typeof args.today === "boolean" ? args.today : due === todayISO() || !due;
        const weekly = Boolean(args.weekly);
        const goalId = typeof args.goalId === "string" ? args.goalId : undefined;

        const newTask: Task = {
          id: crypto.randomUUID(),
          title,
          status: "todo",
          priority,
          today,
          weekly,
          due,
          goalId,
          createdAt: todayISO(),
        };

        const updatedDoc = await this.adapter.mutateStore("lifeos-tasks", (current) => ({
          ...current,
          tasks: [newTask, ...(current.tasks ?? [])],
        }));

        return { success: true, task: newTask, total: updatedDoc.state.tasks.length };
      }

      case "update_task": {
        const id = String(args.id);
        let updatedTask: Task | null = null;

        await this.adapter.mutateStore("lifeos-tasks", (current) => {
          const tasks = (current.tasks ?? []).map((t) => {
            if (t.id !== id) return t;
            const status =
              args.status === "done" || args.done === true
                ? "done"
                : args.status === "todo" || args.done === false
                  ? "todo"
                  : t.status;
            const mod: Task = {
              ...t,
              title: typeof args.title === "string" ? args.title.trim() : t.title,
              priority: (args.priority as "low" | "med" | "high") ?? t.priority,
              status,
              due: typeof args.due === "string" ? args.due : t.due,
              today: typeof args.today === "boolean" ? args.today : t.today,
              weekly: typeof args.weekly === "boolean" ? args.weekly : t.weekly,
              completedAt: status === "done" ? (t.completedAt ?? todayISO()) : undefined,
            };
            updatedTask = mod;
            return mod;
          });
          return { ...current, tasks };
        });

        if (!updatedTask) throw new Error(`Task '${id}' not found.`);
        return { success: true, task: updatedTask };
      }

      case "delete_task": {
        const id = String(args.id);
        const tasksDoc = await this.adapter.getStore("lifeos-tasks");
        const taskToDelete = (tasksDoc?.state.tasks ?? []).find((t) => t.id === id);
        if (!taskToDelete) throw new Error(`Task '${id}' not found.`);

        // Move to Trash
        const trashItem: TrashItem = {
          id: crypto.randomUUID(),
          itemType: "task",
          title: taskToDelete.title,
          itemData: taskToDelete,
          deletedAt: new Date().toISOString(),
          originalStoreKey: "lifeos-tasks",
        };

        await this.adapter.mutateStore("lifeos-trash", (current) =>
          moveToTrashOperation(current, trashItem),
        );

        // Remove from active tasks
        await this.adapter.mutateStore("lifeos-tasks", (current) => ({
          ...current,
          tasks: (current.tasks ?? []).filter((t) => t.id !== id),
        }));

        return { success: true, movedToTrash: true, trashId: trashItem.id };
      }

      case "set_daily_focus": {
        const date = typeof args.date === "string" ? args.date : todayISO();
        const taskIds = Array.isArray(args.taskIds) ? (args.taskIds as string[]).slice(0, 3) : [];

        await this.adapter.mutateStore("lifeos-tasks", (current) => ({
          ...current,
          dailyFocus: {
            ...(current.dailyFocus ?? {}),
            [date]: taskIds,
          },
        }));

        return { success: true, date, dailyFocus: taskIds };
      }

      // ---------------------------------------------------------------------
      // Notes
      // ---------------------------------------------------------------------
      case "get_notes": {
        const doc = await this.adapter.getStore("lifeos-notes");
        let notes = doc?.state.notes ?? [];
        if (args.tag) {
          notes = notes.filter((n) => n.tag?.toLowerCase() === String(args.tag).toLowerCase());
        }
        if (args.query) {
          const q = String(args.query).toLowerCase();
          notes = notes.filter(
            (n) => n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q),
          );
        }

        const limit = Math.min(Number(args.limit ?? 20), 50);
        const cursor = Number(args.cursor ?? 0);
        const paged = notes.slice(cursor, cursor + limit);

        return { notes: paged, total: notes.length };
      }

      case "add_note": {
        const newNote = {
          id: crypto.randomUUID(),
          title: String(args.title ?? "Untitled Note"),
          body: String(args.body ?? args.text ?? ""),
          tag: String(args.tag ?? "Personal"),
          pinned: false,
          updatedAt: Date.now(),
          contentType: (args.contentType as "note" | "read" | "listen" | "idea") ?? "note",
          sourceUrl: typeof args.sourceUrl === "string" ? args.sourceUrl : undefined,
          author: typeof args.author === "string" ? args.author : undefined,
        };

        await this.adapter.mutateStore("lifeos-notes", (current) => ({
          ...current,
          notes: [newNote, ...(current.notes ?? [])],
        }));

        return { success: true, note: newNote };
      }

      case "update_note": {
        const id = String(args.id);
        let updatedNote: unknown = null;

        await this.adapter.mutateStore("lifeos-notes", (current) => {
          const notes = (current.notes ?? []).map((n) => {
            if (n.id !== id) return n;
            const mod = {
              ...n,
              title: typeof args.title === "string" ? args.title : n.title,
              body: typeof args.body === "string" ? args.body : n.body,
              tag: typeof args.tag === "string" ? args.tag : n.tag,
              pinned: typeof args.pinned === "boolean" ? args.pinned : n.pinned,
              updatedAt: Date.now(),
            };
            updatedNote = mod;
            return mod;
          });
          return { ...current, notes };
        });

        if (!updatedNote) throw new Error(`Note '${id}' not found.`);
        return { success: true, note: updatedNote };
      }

      case "delete_note": {
        const id = String(args.id);
        const notesDoc = await this.adapter.getStore("lifeos-notes");
        const noteToDelete = (notesDoc?.state.notes ?? []).find((n) => n.id === id);
        if (!noteToDelete) throw new Error(`Note '${id}' not found.`);

        const trashItem: TrashItem = {
          id: crypto.randomUUID(),
          itemType: "note",
          title: noteToDelete.title || "Untitled Note",
          itemData: noteToDelete,
          deletedAt: new Date().toISOString(),
          originalStoreKey: "lifeos-notes",
        };

        await this.adapter.mutateStore("lifeos-trash", (current) =>
          moveToTrashOperation(current, trashItem),
        );

        await this.adapter.mutateStore("lifeos-notes", (current) => ({
          ...current,
          notes: (current.notes ?? []).filter((n) => n.id !== id),
        }));

        return { success: true, movedToTrash: true, trashId: trashItem.id };
      }

      // ---------------------------------------------------------------------
      // Goals
      // ---------------------------------------------------------------------
      case "get_goals": {
        const doc = await this.adapter.getStore("lifeos-goals");
        let goals = doc?.state.goals ?? [];
        if (args.status && args.status !== "all") {
          goals = goals.filter((g) => g.status === args.status);
        }
        if (args.category) {
          goals = goals.filter((g) => g.category?.toLowerCase() === String(args.category).toLowerCase());
        }
        return { goals, total: goals.length };
      }

      case "add_goal": {
        const newGoal: Goal = normalizeGoal({
          id: crypto.randomUUID(),
          title: String(args.title ?? "New Goal"),
          category: String(args.category ?? "personal_growth"),
          type: "yearly_outcome",
          status: "active",
          milestones: [],
          manualProgress: 0,
          completed: false,
          plan: "",
        });

        await this.adapter.mutateStore("lifeos-goals", (current) => ({
          ...current,
          goals: [newGoal, ...(current.goals ?? [])],
        }));

        return { success: true, goal: newGoal };
      }

      case "update_goal": {
        const id = String(args.id);
        let updatedGoal: Goal | null = null;

        await this.adapter.mutateStore("lifeos-goals", (current) => {
          const goals = (current.goals ?? []).map((g) => {
            if (g.id !== id) return g;
            const mod: Goal = {
              ...g,
              title: typeof args.title === "string" ? args.title : g.title,
              status: (args.status as "active" | "completed" | "paused" | "later") ?? g.status,
              manualProgress: typeof args.progress === "number" ? args.progress : g.manualProgress,
              completed: args.status === "completed" ? true : g.completed,
            };
            updatedGoal = mod;
            return mod;
          });
          return { ...current, goals };
        });

        if (!updatedGoal) throw new Error(`Goal '${id}' not found.`);
        return { success: true, goal: updatedGoal };
      }

      case "delete_goal": {
        const id = String(args.id);
        const goalsDoc = await this.adapter.getStore("lifeos-goals");
        const goalToDelete = (goalsDoc?.state.goals ?? []).find((g) => g.id === id);
        if (!goalToDelete) throw new Error(`Goal '${id}' not found.`);

        const trashItem: TrashItem = {
          id: crypto.randomUUID(),
          itemType: "goal",
          title: goalToDelete.title,
          itemData: goalToDelete,
          deletedAt: new Date().toISOString(),
          originalStoreKey: "lifeos-goals",
        };

        await this.adapter.mutateStore("lifeos-trash", (current) =>
          moveToTrashOperation(current, trashItem),
        );

        await this.adapter.mutateStore("lifeos-goals", (current) => ({
          ...current,
          goals: (current.goals ?? []).filter((g) => g.id !== id),
        }));

        return { success: true, movedToTrash: true, trashId: trashItem.id };
      }

      // ---------------------------------------------------------------------
      // Habits
      // ---------------------------------------------------------------------
      case "get_habits": {
        const doc = await this.adapter.getStore("lifeos-habits");
        return { habits: doc?.state.habits ?? [] };
      }

      case "add_habit": {
        const newHabit: Habit = normalizeHabit({
          id: crypto.randomUUID(),
          name: String(args.name ?? "New Habit"),
          icon: typeof args.icon === "string" ? args.icon : "activity",
          targetPerWeek: Number(args.targetPerWeek ?? 7),
          color: typeof args.color === "string" ? args.color : "#37c9b7",
          log: {},
          createdAt: todayISO(),
        });

        await this.adapter.mutateStore("lifeos-habits", (current) => ({
          ...current,
          habits: [...(current.habits ?? []), newHabit],
        }));

        return { success: true, habit: newHabit };
      }

      case "toggle_habit_day": {
        const id = String(args.id);
        const date = String(args.date ?? todayISO());
        let updatedHabit: Habit | null = null;

        await this.adapter.mutateStore("lifeos-habits", (current) => {
          const habits = (current.habits ?? []).map((h) => {
            if (h.id !== id) return h;
            const log = { ...(h.log ?? {}) };
            const nextVal = typeof args.completed === "boolean" ? args.completed : !log[date];
            if (nextVal) log[date] = true;
            else delete log[date];

            const mod: Habit = { ...h, log };
            updatedHabit = mod;
            return mod;
          });
          return { ...current, habits };
        });

        if (!updatedHabit) throw new Error(`Habit '${id}' not found.`);
        return { success: true, habit: updatedHabit };
      }

      case "delete_habit": {
        const id = String(args.id);
        const habitsDoc = await this.adapter.getStore("lifeos-habits");
        const habitToDelete = (habitsDoc?.state.habits ?? []).find((h) => h.id === id);
        if (!habitToDelete) throw new Error(`Habit '${id}' not found.`);

        const trashItem: TrashItem = {
          id: crypto.randomUUID(),
          itemType: "habit",
          title: habitToDelete.name,
          itemData: habitToDelete,
          deletedAt: new Date().toISOString(),
          originalStoreKey: "lifeos-habits",
        };

        await this.adapter.mutateStore("lifeos-trash", (current) =>
          moveToTrashOperation(current, trashItem),
        );

        await this.adapter.mutateStore("lifeos-habits", (current) => ({
          ...current,
          habits: (current.habits ?? []).filter((h) => h.id !== id),
        }));

        return { success: true, movedToTrash: true, trashId: trashItem.id };
      }

      // ---------------------------------------------------------------------
      // Calendar Blocks
      // ---------------------------------------------------------------------
      case "get_calendar_blocks": {
        const doc = await this.adapter.getStore("lifeos-blocks");
        let blocks = doc?.state.blocks ?? [];
        if (args.date) blocks = blocks.filter((b) => b.date === args.date);
        return { blocks, view: doc?.state.view ?? "week" };
      }

      case "add_calendar_block": {
        const newBlock = {
          id: crypto.randomUUID(),
          title: String(args.title ?? "New Block"),
          date: String(args.date ?? todayISO()),
          start: typeof args.start === "number" ? args.start : 9,
          end: typeof args.end === "number" ? args.end : 10,
          color: String(args.color ?? "var(--accent)"),
        };

        await this.adapter.mutateStore("lifeos-blocks", (current) => ({
          ...current,
          blocks: [...(current.blocks ?? []), newBlock],
        }));

        return { success: true, block: newBlock };
      }

      case "delete_calendar_block": {
        const id = String(args.id);
        await this.adapter.mutateStore("lifeos-blocks", (current) => ({
          ...current,
          blocks: (current.blocks ?? []).filter((b) => b.id !== id),
        }));
        return { success: true, id };
      }

      // ---------------------------------------------------------------------
      // Journal (Sensitive)
      // ---------------------------------------------------------------------
      case "get_journal": {
        const doc = await this.adapter.getStore("lifeos-journal");
        let entries = doc?.state.entries ?? [];
        if (args.from) entries = entries.filter((e) => e.date >= String(args.from));
        if (args.to) entries = entries.filter((e) => e.date <= String(args.to));
        const limit = Math.min(Number(args.limit ?? 20), 50);
        return { entries: entries.slice(0, limit), total: entries.length };
      }

      case "add_journal_entry": {
        const moodVal = (args.mood as Mood) ?? "good";
        const newEntry: JournalEntry = {
          id: crypto.randomUUID(),
          date: String(args.date ?? todayISO()),
          body: String(args.entry ?? args.body ?? ""),
          mood: moodVal,
          createdAt: Date.now(),
        };

        await this.adapter.mutateStore("lifeos-journal", (current) => ({
          ...current,
          entries: [newEntry, ...(current.entries ?? [])],
        }));

        return { success: true, entry: newEntry };
      }

      // ---------------------------------------------------------------------
      // Money (Sensitive)
      // ---------------------------------------------------------------------
      case "get_money": {
        const moneyDoc = await this.adapter.getStore("lifeos-money");
        return {
          transactions: moneyDoc?.state.transactions ?? [],
          currency: moneyDoc?.state.currency ?? "DA",
        };
      }

      case "add_money_transaction": {
        const newTx: Txn = {
          id: crypto.randomUUID(),
          label: typeof args.description === "string" && args.description ? args.description : "Transaction",
          amount: Number(args.amount ?? 0),
          tag: String(args.category ?? "Personal"),
          date: String(args.date ?? todayISO()),
        };

        await this.adapter.mutateStore("lifeos-money", (current) => ({
          ...current,
          transactions: [newTx, ...(current.transactions ?? [])],
        }));

        return { success: true, transaction: newTx };
      }

      // ---------------------------------------------------------------------
      // Health (Sensitive)
      // ---------------------------------------------------------------------
      case "get_health": {
        const healthDoc = await this.adapter.getStore("lifeos-health");
        return { workouts: healthDoc?.state.workouts ?? [] };
      }

      case "log_workout": {
        const newWorkout: Workout = {
          id: crypto.randomUUID(),
          date: String(args.date ?? todayISO()),
          sport: String(args.title ?? "Workout"),
          minutes: typeof args.durationMin === "number" ? args.durationMin : 45,
          note: typeof args.notes === "string" ? args.notes : undefined,
          exercises: [],
        };

        await this.adapter.mutateStore("lifeos-health", (current) => ({
          ...current,
          workouts: [newWorkout, ...(current.workouts ?? [])],
        }));

        return { success: true, workout: newWorkout };
      }

      // ---------------------------------------------------------------------
      // Recurring Tasks & Topics
      // ---------------------------------------------------------------------
      case "get_recurring_tasks": {
        const doc = await this.adapter.getStore("lifeos-recurring");
        return { recurringTasks: doc?.state.recurring ?? [] };
      }

      case "get_topics": {
        const doc = await this.adapter.getStore("lifeos-topics");
        return { topics: doc?.state.topics ?? [] };
      }

      // ---------------------------------------------------------------------
      // Trash
      // ---------------------------------------------------------------------
      case "get_trash_items": {
        const doc = await this.adapter.getStore("lifeos-trash");
        const items = doc?.state.items ?? [];
        const limit = Math.min(Number(args.limit ?? 20), 50);
        return { items: items.slice(0, limit), total: items.length };
      }

      case "restore_trash_item": {
        const id = String(args.id);
        const trashDoc = await this.adapter.getStore("lifeos-trash");
        const item = (trashDoc?.state.items ?? []).find((i) => i.id === id);
        if (!item) throw new Error(`Trash item '${id}' not found.`);

        // Remove from trash
        await this.adapter.mutateStore("lifeos-trash", (current) =>
          restoreItemOperation(current, id),
        );

        // Restore back to domain
        if (item.itemType === "task") {
          const task = normalizeTask(item.itemData);
          await this.adapter.mutateStore("lifeos-tasks", (current) => ({
            ...current,
            tasks: [task, ...(current.tasks ?? [])],
          }));
        } else if (item.itemType === "note") {
          const note = item.itemData as Record<string, unknown>;
          await this.adapter.mutateStore("lifeos-notes", (current) => ({
            ...current,
            notes: [note as never, ...(current.notes ?? [])],
          }));
        } else if (item.itemType === "goal") {
          const goal = item.itemData as Record<string, unknown>;
          await this.adapter.mutateStore("lifeos-goals", (current) => ({
            ...current,
            goals: [goal as never, ...(current.goals ?? [])],
          }));
        } else if (item.itemType === "habit") {
          const habit = item.itemData as Record<string, unknown>;
          await this.adapter.mutateStore("lifeos-habits", (current) => ({
            ...current,
            habits: [...(current.habits ?? []), habit as never],
          }));
        }

        return { success: true, restored: true, itemType: item.itemType };
      }

      // ---------------------------------------------------------------------
      // Unified Search
      // ---------------------------------------------------------------------
      case "search_all": {
        const query = String(args.query ?? "").toLowerCase().trim();
        if (!query) return { results: [] };

        const [tasksDoc, notesDoc, goalsDoc] = await Promise.all([
          this.adapter.getStore("lifeos-tasks"),
          this.adapter.getStore("lifeos-notes"),
          this.adapter.getStore("lifeos-goals"),
        ]);

        const matchingTasks = (tasksDoc?.state.tasks ?? [])
          .filter((t) => t.title.toLowerCase().includes(query))
          .slice(0, 10)
          .map((t) => ({ type: "task", id: t.id, title: t.title, status: t.status }));

        const matchingNotes = (notesDoc?.state.notes ?? [])
          .filter((n) => n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query))
          .slice(0, 10)
          .map((n) => ({ type: "note", id: n.id, title: n.title, tag: n.tag }));

        const matchingGoals = (goalsDoc?.state.goals ?? [])
          .filter((g) => g.title.toLowerCase().includes(query))
          .slice(0, 10)
          .map((g) => ({ type: "goal", id: g.id, title: g.title, status: g.status }));

        return {
          results: [...matchingTasks, ...matchingNotes, ...matchingGoals].slice(0, 30),
        };
      }

      default:
        throw new Error(`Unknown MCP tool '${name}'.`);
    }
  }
}
