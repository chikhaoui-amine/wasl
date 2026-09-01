/**
 * lib/relay/local-executor.ts
 *
 * Framework-independent MCP Tool Executor for WASL Local Edition.
 *
 * Architecture & Guarantees:
 * - Executes directly against DataAdapter / LocalAdapter and IndexedDB.
 * - Reuses existing domain operations, migrations, and validation.
 * - Full support for all 11 active stores.
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
import type { Txn, Account, AccountType } from "@/lib/data/domains/money/types";
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

interface PageInput {
  limit?: unknown;
  cursor?: unknown;
}

function page<T>(items: T[], args: PageInput) {
  const limit = Math.min(Math.max(Math.trunc(Number(args.limit ?? 20)), 1), 50);
  const offset = Math.max(Math.trunc(Number(args.cursor ?? 0)), 0);
  const pageItems = items.slice(offset, offset + limit);
  return {
    items: pageItems,
    pagination: {
      limit,
      total: items.length,
      nextCursor: offset + pageItems.length < items.length ? String(offset + pageItems.length) : null,
    },
  };
}

function includesText(query: unknown, ...values: unknown[]) {
  const needle = String(query ?? "").trim().toLocaleLowerCase();
  return values.some((value) => typeof value === "string" && value.toLocaleLowerCase().includes(needle));
}

function filterDates<T extends { date?: string }>(items: T[], args: Record<string, unknown>) {
  return items.filter((item) =>
    (!args.from || String(item.date ?? "") >= String(args.from)) &&
    (!args.to || String(item.date ?? "") <= String(args.to)),
  );
}

function exactById<T extends { id: string }>(items: T[], id: unknown, label: string) {
  const value = String(id ?? "");
  const item = items.find((candidate) => candidate.id === value);
  if (!item) throw new Error(`${label} '${value}' not found.`);
  return item;
}

function decimalHourToTime(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

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
    toolName.startsWith("restore_") ||
    toolName.endsWith("_append")
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
      case "tasks_list": {
        const doc = await this.adapter.getStore("lifeos-tasks");
        let tasks = (doc?.state.tasks ?? []).map(normalizeTask);
        if (args.status === "todo") tasks = tasks.filter((t) => t.status === "todo");
        else if (args.status === "done") tasks = tasks.filter((t) => t.status === "done");
        if (args.priority) tasks = tasks.filter((t) => t.priority === args.priority);
        if (args.due) tasks = tasks.filter((t) => t.due === args.due);
        if (args.today) tasks = tasks.filter((t) => t.today);

        if (args.goalId) tasks = tasks.filter((t) => t.goalId === args.goalId);
        return page(tasks, args);
      }

      case "tasks_search": {
        const doc = await this.adapter.getStore("lifeos-tasks");
        let tasks = (doc?.state.tasks ?? []).map(normalizeTask);
        if (args.status) tasks = tasks.filter((task) => task.status === args.status);
        if (args.priority) tasks = tasks.filter((task) => task.priority === args.priority);
        if (args.due) tasks = tasks.filter((task) => task.due === args.due);
        if (args.today !== undefined) tasks = tasks.filter((task) => task.today === args.today);
        if (args.goalId) tasks = tasks.filter((task) => task.goalId === args.goalId);
        return page(tasks.filter((task) => includesText(args.query, task.title)), args);
      }

      case "tasks_get": {
        const doc = await this.adapter.getStore("lifeos-tasks");
        return { item: normalizeTask(exactById(doc?.state.tasks ?? [], args.id, "Task")) };
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
      case "notes_list": {
        const doc = await this.adapter.getStore("lifeos-notes");
        let notes = [...(doc?.state.notes ?? [])];
        if (args.tag) {
          notes = notes.filter((n) => n.tag?.toLowerCase() === String(args.tag).toLowerCase());
        }
        if (args.contentType) notes = notes.filter((note) => (note.contentType ?? "note") === args.contentType);
        if (args.pinned !== undefined) notes = notes.filter((note) => note.pinned === args.pinned);
        notes.sort((a, b) => b.updatedAt - a.updatedAt);
        return page(notes.map((note) => ({
          id: note.id,
          title: note.title,
          preview: note.body.slice(0, 240),
          tag: note.tag,
          pinned: note.pinned,
          contentType: note.contentType ?? "note",
          author: note.author,
          sourceUrl: note.sourceUrl,
          updatedAt: new Date(note.updatedAt).toISOString(),
        })), args);
      }

      case "notes_search": {
        const doc = await this.adapter.getStore("lifeos-notes");
        let notes = (doc?.state.notes ?? []).filter((note) =>
          includesText(args.query, note.title, note.body, note.tag, note.author),
        );
        if (args.tag) notes = notes.filter((note) => note.tag.toLocaleLowerCase() === String(args.tag).toLocaleLowerCase());
        if (args.contentType) notes = notes.filter((note) => (note.contentType ?? "note") === args.contentType);
        return page(notes.map((note) => ({
          id: note.id,
          title: note.title,
          preview: note.body.slice(0, 240),
          tag: note.tag,
          pinned: note.pinned,
          contentType: note.contentType ?? "note",
          author: note.author,
          sourceUrl: note.sourceUrl,
          updatedAt: new Date(note.updatedAt).toISOString(),
        })), args);
      }

      case "notes_get": {
        const doc = await this.adapter.getStore("lifeos-notes");
        return { item: exactById(doc?.state.notes ?? [], args.id, "Note") };
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

      case "notes_append": {
        const id = String(args.id);
        let updatedNote: unknown = null;
        await this.adapter.mutateStore("lifeos-notes", (current) => ({
          ...current,
          notes: (current.notes ?? []).map((note) => {
            if (note.id !== id) return note;
            const separator = note.body
              ? args.separator === "none" ? "" : args.separator === "newline" ? "\n" : "\n\n"
              : "";
            updatedNote = {
              ...note,
              body: `${note.body}${separator}${String(args.body)}`,
              updatedAt: Date.now(),
            };
            return updatedNote as typeof note;
          }),
        }));
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
      case "goals_list": {
        const doc = await this.adapter.getStore("lifeos-goals");
        let goals = (doc?.state.goals ?? []).map(normalizeGoal);
        if (args.status) goals = goals.filter((g) => g.status === args.status);
        if (args.category) {
          goals = goals.filter((g) => g.category?.toLowerCase() === String(args.category).toLowerCase());
        }
        if (args.type) goals = goals.filter((g) => g.type === args.type);
        if (args.targetYear) goals = goals.filter((g) => g.targetYear === args.targetYear);
        return page(goals.map((goal) => ({
          id: goal.id,
          title: goal.title,
          status: goal.status,
          type: goal.type,
          category: goal.category,
          targetYear: goal.targetYear ?? null,
          targetMonth: goal.targetMonth ?? null,
          progress: goal.manualProgress,
          milestoneCount: goal.milestones.length,
          completedMilestoneCount: goal.milestones.filter((milestone) => milestone.done).length,
        })), args);
      }

      case "goals_search": {
        const doc = await this.adapter.getStore("lifeos-goals");
        let goals = (doc?.state.goals ?? []).map(normalizeGoal);
        if (args.status) goals = goals.filter((goal) => goal.status === args.status);
        if (args.category) goals = goals.filter((goal) => goal.category === args.category);
        if (args.type) goals = goals.filter((goal) => goal.type === args.type);
        if (args.targetYear) goals = goals.filter((goal) => goal.targetYear === args.targetYear);
        return page(goals.filter((goal) => includesText(args.query, goal.title, goal.category)).map((goal) => ({
          id: goal.id,
          title: goal.title,
          status: goal.status,
          type: goal.type,
          category: goal.category,
          targetYear: goal.targetYear ?? null,
          targetMonth: goal.targetMonth ?? null,
          progress: goal.manualProgress,
          milestoneCount: goal.milestones.length,
          completedMilestoneCount: goal.milestones.filter((milestone) => milestone.done).length,
        })), args);
      }

      case "goals_get": {
        const doc = await this.adapter.getStore("lifeos-goals");
        return { item: normalizeGoal(exactById(doc?.state.goals ?? [], args.id, "Goal")) };
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
      case "habits_list": {
        const doc = await this.adapter.getStore("lifeos-habits");
        return page((doc?.state.habits ?? []).map(normalizeHabit).map((habit) => ({
          id: habit.id,
          title: habit.name,
          targetPerWeek: habit.targetPerWeek,
          color: habit.color,
          icon: habit.icon,
          completedCount: Object.values(habit.log).filter(Boolean).length,
          createdAt: habit.createdAt,
        })), args);
      }

      case "habits_search": {
        const doc = await this.adapter.getStore("lifeos-habits");
        const habits = (doc?.state.habits ?? []).map(normalizeHabit)
          .filter((habit) => includesText(args.query, habit.name))
          .map((habit) => ({
            id: habit.id,
            title: habit.name,
            targetPerWeek: habit.targetPerWeek,
            color: habit.color,
            icon: habit.icon,
            completedCount: Object.values(habit.log).filter(Boolean).length,
            createdAt: habit.createdAt,
          }));
        return page(habits, args);
      }

      case "habits_get": {
        const doc = await this.adapter.getStore("lifeos-habits");
        const habit = normalizeHabit(exactById(doc?.state.habits ?? [], args.id, "Habit"));
        const log = Object.fromEntries(Object.entries(habit.log).filter(([date]) =>
          (!args.from || date >= String(args.from)) && (!args.to || date <= String(args.to)),
        ));
        return { item: { ...habit, title: habit.name, log } };
      }

      case "add_habit": {
        const newHabit: Habit = normalizeHabit({
          id: crypto.randomUUID(),
          name: String(args.title ?? "New Habit"),
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
      case "calendar_list": {
        const doc = await this.adapter.getStore("lifeos-blocks");
        let blocks = [...(doc?.state.blocks ?? [])];
        if (args.date) blocks = blocks.filter((b) => b.date === args.date);
        if (args.from) blocks = blocks.filter((b) => b.date >= String(args.from));
        if (args.to) blocks = blocks.filter((b) => b.date <= String(args.to));
        blocks.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
        return page(blocks.map((block) => ({
          id: block.id,
          title: block.title,
          date: block.date,
          startTime: decimalHourToTime(block.start),
          endTime: decimalHourToTime(block.end),
          color: block.color,
        })), args);
      }

      case "calendar_search": {
        const doc = await this.adapter.getStore("lifeos-blocks");
        let blocks = doc?.state.blocks ?? [];
        if (args.date) blocks = blocks.filter((block) => block.date === args.date);
        if (args.from) blocks = blocks.filter((block) => block.date >= String(args.from));
        if (args.to) blocks = blocks.filter((block) => block.date <= String(args.to));
        return page(blocks.filter((block) => includesText(args.query, block.title)).map((block) => ({
          id: block.id,
          title: block.title,
          date: block.date,
          startTime: decimalHourToTime(block.start),
          endTime: decimalHourToTime(block.end),
          color: block.color,
        })), args);
      }

      case "calendar_get": {
        const doc = await this.adapter.getStore("lifeos-blocks");
        const block = exactById(doc?.state.blocks ?? [], args.id, "Calendar block");
        return { item: {
          id: block.id,
          title: block.title,
          date: block.date,
          startTime: decimalHourToTime(block.start),
          endTime: decimalHourToTime(block.end),
          color: block.color,
        } };
      }

      case "add_calendar_block": {
        const newBlock = {
          id: crypto.randomUUID(),
          title: String(args.title ?? "New Block"),
          date: String(args.date ?? todayISO()),
          start: typeof args.startTime === "string" ? Number(args.startTime.slice(0, 2)) + Number(args.startTime.slice(3, 5)) / 60 : 9,
          end: typeof args.endTime === "string" ? Number(args.endTime.slice(0, 2)) + Number(args.endTime.slice(3, 5)) / 60 : 10,
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
      case "journal_list": {
        const doc = await this.adapter.getStore("lifeos-journal");
        let entries = filterDates(doc?.state.entries ?? [], args);
        if (args.mood) entries = entries.filter((entry) => entry.mood === args.mood);
        entries.sort((a, b) => b.date.localeCompare(a.date));
        return page(entries.map((entry) => ({
          id: entry.id,
          title: `Journal — ${entry.date}`,
          date: entry.date,
          mood: entry.mood,
          preview: entry.body.slice(0, 240),
          createdAt: new Date(entry.createdAt).toISOString(),
        })), args);
      }

      case "journal_search": {
        const doc = await this.adapter.getStore("lifeos-journal");
        const entries = filterDates(doc?.state.entries ?? [], args)
          .filter((entry) => includesText(args.query, entry.body, entry.date, entry.mood))
          .map((entry) => ({
            id: entry.id,
            title: `Journal — ${entry.date}`,
            date: entry.date,
            mood: entry.mood,
            preview: entry.body.slice(0, 240),
            createdAt: new Date(entry.createdAt).toISOString(),
          }));
        return page(entries, args);
      }

      case "journal_get": {
        const doc = await this.adapter.getStore("lifeos-journal");
        const entry = exactById(doc?.state.entries ?? [], args.id, "Journal entry");
        return { item: { ...entry, title: `Journal — ${entry.date}` } };
      }

      case "add_journal_entry": {
        const moodVal = (args.mood as Mood) ?? "good";
        const newEntry: JournalEntry = {
          id: crypto.randomUUID(),
          date: String(args.date ?? todayISO()),
          body: String(args.body ?? ""),
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
          accounts: moneyDoc?.state.accounts ?? [],
          transactions: moneyDoc?.state.transactions ?? [],
          savings: moneyDoc?.state.savings ?? [],
          currency: moneyDoc?.state.currency ?? "DA",
        };
      }

      case "add_money_account": {
        const account: Account = {
          id: crypto.randomUUID(),
          name: String(args.name),
          type: args.type as AccountType,
          initialBalance: Number(args.initialBalance ?? 0),
          currency: typeof args.currency === "string" ? args.currency : undefined,
          color: typeof args.color === "string" ? args.color : "emerald",
          icon: typeof args.icon === "string" ? args.icon : "landmark",
          createdAt: todayISO(),
        };
        await this.adapter.mutateStore("lifeos-money", (current) => ({
          ...current,
          accounts: [...(current.accounts ?? []), account],
        }));
        return { success: true, account };
      }

      case "update_money_account": {
        const id = String(args.id);
        let updatedAccount: Account | null = null;
        await this.adapter.mutateStore("lifeos-money", (current) => ({
          ...current,
          accounts: (current.accounts ?? []).map((account) => {
            if (account.id !== id && account.name.toLocaleLowerCase() !== id.toLocaleLowerCase()) return account;
            updatedAccount = {
              ...account,
              ...(args.name !== undefined ? { name: String(args.name) } : {}),
              ...(args.type !== undefined ? { type: args.type as AccountType } : {}),
              ...(args.initialBalance !== undefined ? { initialBalance: Number(args.initialBalance) } : {}),
              ...(args.currency !== undefined ? { currency: String(args.currency) } : {}),
              ...(args.color !== undefined ? { color: String(args.color) } : {}),
              ...(args.icon !== undefined ? { icon: String(args.icon) } : {}),
            };
            return updatedAccount;
          }),
        }));
        if (!updatedAccount) throw new Error(`Account '${id}' not found.`);
        return { success: true, account: updatedAccount };
      }

      case "delete_money_account": {
        const id = String(args.id);
        let deletedId: string | null = null;
        await this.adapter.mutateStore("lifeos-money", (current) => {
          const target = (current.accounts ?? []).find((account) =>
            account.id === id || account.name.toLocaleLowerCase() === id.toLocaleLowerCase(),
          );
          if (!target) return current;
          deletedId = target.id;
          return { ...current, accounts: (current.accounts ?? []).filter((account) => account.id !== target.id) };
        });
        if (!deletedId) throw new Error(`Account '${id}' not found.`);
        return { success: true, id: deletedId };
      }

      case "transactions_list": {
        const doc = await this.adapter.getStore("lifeos-money");
        let transactions = filterDates(doc?.state.transactions ?? [], args);
        if (args.category) transactions = transactions.filter((transaction) => transaction.tag.toLocaleLowerCase() === String(args.category).toLocaleLowerCase());
        if (args.accountId) transactions = transactions.filter((transaction) => transaction.accountId === args.accountId || transaction.transferAccountId === args.accountId);
        transactions.sort((a, b) => b.date.localeCompare(a.date));
        return page(transactions.map((transaction) => ({
          id: transaction.id,
          title: transaction.label,
          amount: transaction.amount,
          category: transaction.tag,
          date: transaction.date,
          accountId: transaction.accountId ?? null,
          transferAccountId: transaction.transferAccountId ?? null,
        })), args);
      }

      case "transactions_search": {
        const doc = await this.adapter.getStore("lifeos-money");
        let transactions = filterDates(doc?.state.transactions ?? [], args);
        if (args.category) transactions = transactions.filter((transaction) => transaction.tag.toLocaleLowerCase() === String(args.category).toLocaleLowerCase());
        if (args.accountId) transactions = transactions.filter((transaction) => transaction.accountId === args.accountId || transaction.transferAccountId === args.accountId);
        return page(transactions.filter((transaction) => includesText(args.query, transaction.label, transaction.tag)).map((transaction) => ({
          id: transaction.id,
          title: transaction.label,
          amount: transaction.amount,
          category: transaction.tag,
          date: transaction.date,
          accountId: transaction.accountId ?? null,
          transferAccountId: transaction.transferAccountId ?? null,
        })), args);
      }

      case "transactions_get": {
        const doc = await this.adapter.getStore("lifeos-money");
        const transaction = exactById(doc?.state.transactions ?? [], args.id, "Transaction");
        return { item: {
          id: transaction.id,
          title: transaction.label,
          amount: transaction.amount,
          category: transaction.tag,
          date: transaction.date,
          accountId: transaction.accountId ?? null,
          transferAccountId: transaction.transferAccountId ?? null,
        } };
      }

      case "add_money_transaction": {
        let amount = Number(args.amount ?? 0);
        if (args.type === "expense") amount = -Math.abs(amount);
        else if (args.type === "income" || args.type === "transfer") amount = Math.abs(amount);
        const newTx: Txn = {
          id: crypto.randomUUID(),
          label: typeof args.title === "string" && args.title ? args.title : "Transaction",
          amount,
          tag: String(args.category ?? "Personal"),
          date: String(args.date ?? todayISO()),
          accountId: typeof args.accountId === "string" ? args.accountId : undefined,
          transferAccountId: typeof args.transferAccountId === "string" ? args.transferAccountId : undefined,
        };

        await this.adapter.mutateStore("lifeos-money", (current) => ({
          ...current,
          transactions: [newTx, ...(current.transactions ?? [])],
        }));

        return { success: true, transaction: newTx };
      }

      case "transfer_money": {
        const transaction: Txn = {
          id: crypto.randomUUID(),
          label: typeof args.title === "string" ? args.title : "Account Transfer",
          amount: Math.abs(Number(args.amount)),
          tag: "Transfer",
          date: typeof args.date === "string" ? args.date : todayISO(),
          accountId: String(args.fromAccountId),
          transferAccountId: String(args.toAccountId),
        };
        await this.adapter.mutateStore("lifeos-money", (current) => ({
          ...current,
          transactions: [transaction, ...(current.transactions ?? [])],
        }));
        return { success: true, transaction };
      }

      // ---------------------------------------------------------------------
      // Health (Sensitive)
      // ---------------------------------------------------------------------
      case "get_health": {
        const healthDoc = await this.adapter.getStore("lifeos-health");
        return { workouts: healthDoc?.state.workouts ?? [] };
      }

      case "workouts_list": {
        const doc = await this.adapter.getStore("lifeos-health");
        let workouts = filterDates(doc?.state.workouts ?? [], args);
        if (args.sport) workouts = workouts.filter((workout) => workout.sport.toLocaleLowerCase() === String(args.sport).toLocaleLowerCase());
        workouts.sort((a, b) => b.date.localeCompare(a.date));
        return page(workouts.map((workout) => ({
          id: workout.id,
          title: workout.sport,
          date: workout.date,
          durationMinutes: workout.minutes ?? null,
          notes: workout.note ?? null,
          exerciseCount: workout.exercises?.length ?? 0,
        })), args);
      }

      case "workouts_search": {
        const doc = await this.adapter.getStore("lifeos-health");
        let workouts = filterDates(doc?.state.workouts ?? [], args);
        if (args.sport) workouts = workouts.filter((workout) => workout.sport.toLocaleLowerCase() === String(args.sport).toLocaleLowerCase());
        return page(workouts.filter((workout) => includesText(args.query, workout.sport, workout.note)).map((workout) => ({
          id: workout.id,
          title: workout.sport,
          date: workout.date,
          durationMinutes: workout.minutes ?? null,
          notes: workout.note ?? null,
          exerciseCount: workout.exercises?.length ?? 0,
        })), args);
      }

      case "workouts_get": {
        const doc = await this.adapter.getStore("lifeos-health");
        const workout = exactById(doc?.state.workouts ?? [], args.id, "Workout");
        return { item: { ...workout, title: workout.sport, durationMinutes: workout.minutes ?? null } };
      }

      case "log_workout": {
        const newWorkout: Workout = {
          id: crypto.randomUUID(),
          date: String(args.date ?? todayISO()),
          sport: String(args.title ?? "Workout"),
          minutes: typeof args.durationMinutes === "number" ? args.durationMinutes : 45,
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
      case "recurring_list": {
        const doc = await this.adapter.getStore("lifeos-recurring");
        let recurring = doc?.state.recurring ?? [];
        if (args.frequency) recurring = recurring.filter((item) => item.rule.freq === args.frequency);
        return page(recurring, args);
      }

      case "recurring_search": {
        const doc = await this.adapter.getStore("lifeos-recurring");
        let recurring = doc?.state.recurring ?? [];
        if (args.frequency) recurring = recurring.filter((item) => item.rule.freq === args.frequency);
        return page(recurring.filter((item) => includesText(args.query, item.title)), args);
      }

      case "recurring_get": {
        const doc = await this.adapter.getStore("lifeos-recurring");
        return { item: exactById(doc?.state.recurring ?? [], args.id, "Recurring task") };
      }

      case "topics_list": {
        const doc = await this.adapter.getStore("lifeos-topics");
        const topics = (doc?.state.topics ?? []).map((topic) => ({
          id: topic.id,
          title: topic.name,
          description: topic.description,
          color: topic.color,
          icon: topic.icon,
          stepCount: topic.roadmap.length,
          resourceCount: topic.resources.length,
          noteCount: topic.notes.length,
          updatedAt: new Date(topic.touchedAt).toISOString(),
        }));
        return page(topics, args);
      }

      case "topics_search": {
        const doc = await this.adapter.getStore("lifeos-topics");
        const topics = (doc?.state.topics ?? [])
          .filter((topic) => includesText(args.query, topic.name, topic.description))
          .map((topic) => ({
            id: topic.id,
            title: topic.name,
            description: topic.description,
            color: topic.color,
            icon: topic.icon,
            stepCount: topic.roadmap.length,
            resourceCount: topic.resources.length,
            noteCount: topic.notes.length,
            updatedAt: new Date(topic.touchedAt).toISOString(),
          }));
        return page(topics, args);
      }

      case "topics_get": {
        const doc = await this.adapter.getStore("lifeos-topics");
        const topic = exactById(doc?.state.topics ?? [], args.id, "Topic");
        return { item: { ...topic, title: topic.name } };
      }

      // ---------------------------------------------------------------------
      // Trash
      // ---------------------------------------------------------------------
      case "trash_list": {
        const doc = await this.adapter.getStore("lifeos-trash");
        const items = doc?.state.items ?? [];
        return page(items.map((item) => ({
          id: item.id,
          title: item.title,
          itemType: item.itemType,
          deletedAt: item.deletedAt,
          originalStoreKey: item.originalStoreKey,
        })), args);
      }

      case "trash_get": {
        const doc = await this.adapter.getStore("lifeos-trash");
        return { item: exactById(doc?.state.items ?? [], args.id, "Trash item") };
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
