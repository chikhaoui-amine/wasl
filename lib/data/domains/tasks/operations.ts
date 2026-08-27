import { todayISO } from "@/lib/date";
import type { TasksPersistedState } from "../../types";
import {
  ensureDailyFocus,
  removeTaskFromDailyFocus,
  setDailyFocusSlot,
  type DailyFocus,
} from "@/lib/tasks/focus";

export type Priority = "low" | "med" | "high";
export type TaskStatus = "todo" | "done";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  goalId?: string;
  due?: string; // ISO date
  today: boolean;
  weekly?: boolean; // Weekly task flag
  estimateMin?: number;
  createdAt: string;
  completedAt?: string;
}

export interface TaskInput {
  title: string;
  priority: Priority;
  goalId?: string;
  due?: string;
  today: boolean;
  weekly?: boolean;
  estimateMin?: number;
}

export function createDefaultTasksState(): TasksPersistedState {
  const t = todayISO();
  const t1 = "task-sample-1";
  const t2 = "task-sample-2";
  const t3 = "task-sample-3";
  return {
    tasks: [
      {
        id: t1,
        title: "Deep work focus block: Core system architecture",
        status: "todo",
        priority: "high",
        today: true,
        due: t,
        estimateMin: 90,
        goalId: "goal-sample-2",
        createdAt: t,
      },
      {
        id: t2,
        title: "Afternoon 5K zone 2 training run",
        status: "todo",
        priority: "high",
        today: true,
        due: t,
        estimateMin: 45,
        goalId: "goal-sample-1",
        createdAt: t,
      },
      {
        id: t3,
        title: "Review quarterly goals & upcoming milestones",
        status: "todo",
        priority: "med",
        today: true,
        due: t,
        estimateMin: 30,
        goalId: "goal-sample-2",
        createdAt: t,
      },
      {
        id: "task-sample-4",
        title: "Capture reading highlights into Notes & Knowledge Topic",
        status: "todo",
        priority: "low",
        today: true,
        due: t,
        estimateMin: 20,
        goalId: "goal-sample-3",
        createdAt: t,
      },
      {
        id: "task-sample-5",
        title: "Weekly financial audit & budget check",
        status: "todo",
        priority: "med",
        today: false,
        weekly: true,
        createdAt: t,
      },
    ],
    dailyFocus: {
      [t]: [t1, t2, t3],
    },
  };
}

export function normalizeTask(raw: unknown): Task {
  if (!raw || typeof raw !== "object") {
    return {
      id: crypto.randomUUID(),
      title: "Untitled Task",
      status: "todo",
      priority: "med",
      today: true,
      createdAt: todayISO(),
    };
  }

  const t = raw as Record<string, unknown>;
  const status: TaskStatus = t.status === "done" || t.done === true ? "done" : "todo";
  const rawPriority: Priority =
    t.priority === "high" ? "high" : t.priority === "low" ? "low" : "med";
  const due = typeof t.due === "string" ? t.due : typeof t.date === "string" ? t.date : undefined;
  const today = typeof t.today === "boolean" ? t.today : due === todayISO() || !due;

  const res: Task = {
    id: typeof t.id === "string" && t.id ? t.id : crypto.randomUUID(),
    title: typeof t.title === "string" && t.title.trim() ? t.title.trim() : "Untitled Task",
    status,
    priority: rawPriority,
    today,
    createdAt: typeof t.createdAt === "string" ? t.createdAt : todayISO(),
  };

  if (due) res.due = due;
  if (typeof t.goalId === "string" && t.goalId) res.goalId = t.goalId;
  if (t.weekly) res.weekly = true;
  if (typeof t.estimateMin === "number") res.estimateMin = t.estimateMin;
  if (status === "done") {
    res.completedAt = typeof t.completedAt === "string" ? t.completedAt : todayISO();
  }

  return res;
}

export function normalizeTasksState(raw: unknown): TasksPersistedState {
  if (!raw || typeof raw !== "object") {
    return createDefaultTasksState();
  }
  const state = raw as Record<string, unknown>;
  const dailyFocus: DailyFocus =
    state.dailyFocus && typeof state.dailyFocus === "object"
      ? Object.fromEntries(
          Object.entries(state.dailyFocus as Record<string, unknown>).flatMap(([date, taskIds]) =>
            Array.isArray(taskIds)
              ? [[date, taskIds.filter((id): id is string => typeof id === "string").slice(0, 3)]]
              : [],
          ),
        )
      : {};

  return {
    tasks: Array.isArray(state.tasks) ? state.tasks.map(normalizeTask) : [],
    dailyFocus,
  };
}

export function addTaskOperation(current: TasksPersistedState, newTask: Task): TasksPersistedState {
  return {
    ...current,
    tasks: [normalizeTask(newTask), ...current.tasks],
  };
}

export function updateTaskOperation(
  current: TasksPersistedState,
  id: string,
  patch: Partial<TaskInput>,
): TasksPersistedState {
  return {
    ...current,
    tasks: current.tasks.map((t) => (t.id === id ? normalizeTask({ ...t, ...patch }) : t)),
  };
}

export function toggleTaskOperation(current: TasksPersistedState, id: string): TasksPersistedState {
  return {
    ...current,
    tasks: current.tasks.map((t) => {
      if (t.id !== id) return t;
      const isDone = t.status === "done";
      return {
        ...t,
        status: isDone ? "todo" : "done",
        completedAt: isDone ? undefined : todayISO(),
      };
    }),
  };
}

export function deleteTaskOperation(current: TasksPersistedState, id: string): TasksPersistedState {
  return {
    ...current,
    tasks: current.tasks.filter((t) => t.id !== id),
    dailyFocus: removeTaskFromDailyFocus(current.dailyFocus, id),
  };
}

export function initializeDailyFocusOperation(
  current: TasksPersistedState,
  date: string,
): TasksPersistedState {
  return {
    ...current,
    dailyFocus: ensureDailyFocus(current.dailyFocus, current.tasks, date),
  };
}

export function setDailyFocusTaskOperation(
  current: TasksPersistedState,
  date: string,
  slot: number,
  taskId: string,
): TasksPersistedState {
  const candidate = current.tasks.find((task) => task.id === taskId);
  if (!candidate || candidate.status !== "todo") return current;
  return {
    ...current,
    dailyFocus: setDailyFocusSlot(current.dailyFocus, date, slot, taskId),
  };
}
