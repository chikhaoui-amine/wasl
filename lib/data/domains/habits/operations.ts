import type { HabitsPersistedState } from "../../types";
import type { Habit } from "./types";
import { HABIT_COLORS } from "./constants";
import { DEFAULT_ICON, iconKeyFromLegacy, type IconKey } from "@/lib/icons";
import { addDays, streakFrom, todayISO, weekISO } from "@/lib/date";

export { HABIT_COLORS };

export function createDefaultHabitsState(): HabitsPersistedState {
  const t = todayISO();
  const d1 = addDays(t, -1);
  const d2 = addDays(t, -2);
  const d3 = addDays(t, -3);

  return {
    habits: [
      {
        id: "habit-sample-1",
        name: "Morning Physical Training",
        icon: "dumbbell",
        targetPerWeek: 5,
        color: "#37c9b7",
        createdAt: d3,
        log: { [d3]: true, [d2]: true, [d1]: true },
      },
      {
        id: "habit-sample-2",
        name: "Read & Learn (20 mins)",
        icon: "book-open",
        targetPerWeek: 7,
        color: "#b57edc",
        createdAt: d3,
        log: { [d3]: true, [d2]: true, [d1]: true, [t]: true },
      },
      {
        id: "habit-sample-3",
        name: "Deep Work Focus Block",
        icon: "zap",
        targetPerWeek: 5,
        color: "#7c9cf5",
        createdAt: d3,
        log: { [d2]: true, [d1]: true },
      },
      {
        id: "habit-sample-4",
        name: "Evening Reflection & Journal",
        icon: "feather",
        targetPerWeek: 7,
        color: "#e0a34a",
        createdAt: d3,
        log: { [d3]: true, [d2]: true, [d1]: true },
      },
    ],
  };
}

export function normalizeHabit(raw: unknown): Habit {
  const h = (raw && typeof raw === "object" ? raw : {}) as Partial<Habit> & Record<string, unknown>;
  const name = typeof h.name === "string" && h.name.trim() ? h.name.trim() : "Untitled habit";
  const id = typeof h.id === "string" && h.id.trim() ? h.id : crypto.randomUUID();
  const icon = iconKeyFromLegacy(typeof h.icon === "string" ? h.icon : undefined);
  const targetPerWeek =
    typeof h.targetPerWeek === "number" && !Number.isNaN(h.targetPerWeek)
      ? Math.max(1, Math.min(7, Math.round(h.targetPerWeek)))
      : 7;
  const color =
    typeof h.color === "string" && HABIT_COLORS.includes(h.color as (typeof HABIT_COLORS)[number])
      ? (h.color as (typeof HABIT_COLORS)[number])
      : HABIT_COLORS[0];
  const createdAt = typeof h.createdAt === "string" && h.createdAt ? h.createdAt : todayISO();
  const rawLog = (h.log && typeof h.log === "object" ? h.log : {}) as Record<string, unknown>;
  const log: Record<string, boolean> = {};

  for (const [date, val] of Object.entries(rawLog)) {
    if (val) {
      log[date] = true;
    }
  }

  return {
    id,
    name,
    icon,
    targetPerWeek,
    color,
    createdAt,
    log,
  };
}

export function normalizeHabitsState(current: unknown): HabitsPersistedState {
  if (!current || typeof current !== "object") {
    return { habits: [] };
  }
  const s = current as Partial<HabitsPersistedState> & { habits?: unknown[] };
  const rawList = Array.isArray(s.habits) ? s.habits : [];
  return {
    habits: rawList.map(normalizeHabit),
  };
}

export function addHabitOperation(
  current: HabitsPersistedState | null | undefined,
  input: Omit<Habit, "id" | "createdAt" | "log"> & Partial<Pick<Habit, "createdAt" | "log">>,
  preGeneratedId: string,
): HabitsPersistedState {
  const base = normalizeHabitsState(current);
  const newHabit: Habit = {
    id: preGeneratedId,
    name: input.name.trim() || "Untitled habit",
    icon: (input.icon as IconKey) || DEFAULT_ICON,
    targetPerWeek: Math.max(1, Math.min(7, Math.round(input.targetPerWeek || 7))),
    color: input.color || HABIT_COLORS[0],
    createdAt: input.createdAt || todayISO(),
    log: input.log || {},
  };
  return {
    habits: [newHabit, ...base.habits],
  };
}

export function updateHabitOperation(
  current: HabitsPersistedState | null | undefined,
  id: string,
  patch: Partial<Omit<Habit, "id">>,
): HabitsPersistedState {
  const base = normalizeHabitsState(current);
  return {
    habits: base.habits.map((h) => {
      if (h.id !== id) return h;
      return normalizeHabit({
        ...h,
        ...patch,
        name: patch.name !== undefined ? patch.name.trim() : h.name,
      });
    }),
  };
}

export function toggleDayOperation(
  current: HabitsPersistedState | null | undefined,
  id: string,
  iso: string,
): HabitsPersistedState {
  const base = normalizeHabitsState(current);
  return {
    habits: base.habits.map((h) => {
      if (h.id !== id) return h;
      const log = { ...h.log };
      if (log[iso]) {
        delete log[iso];
      } else {
        log[iso] = true;
      }
      return { ...h, log };
    }),
  };
}

export function deleteHabitOperation(
  current: HabitsPersistedState | null | undefined,
  id: string,
): HabitsPersistedState {
  const base = normalizeHabitsState(current);
  return {
    habits: base.habits.filter((h) => h.id !== id),
  };
}

export function moveHabitOperation(
  current: HabitsPersistedState | null | undefined,
  id: string,
  direction: "up" | "down",
): HabitsPersistedState {
  const base = normalizeHabitsState(current);
  const idx = base.habits.findIndex((h) => h.id === id);
  if (idx < 0) return base;
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= base.habits.length) return base;
  const habits = [...base.habits];
  const [moved] = habits.splice(idx, 1);
  habits.splice(targetIdx, 0, moved);
  return { habits };
}

export function reorderHabitsOperation(
  current: HabitsPersistedState | null | undefined,
  newOrder: Habit[],
): HabitsPersistedState {
  return {
    habits: newOrder.map(normalizeHabit),
  };
}

/* ---------- derived helpers ---------- */

export const habitStreak = (h: Habit): number =>
  streakFrom(new Set(Object.keys(h?.log ?? {}).filter((k) => h?.log?.[k])));

export const weekDone = (h: Habit): number =>
  weekISO().filter((iso) => h?.log?.[iso]).length;

export const consistencyGrid = (habits: Habit[], nWeeks = 5): number[][] => {
  const thisMonday = weekISO()[0];
  const grid: number[][] = [];
  for (let w = nWeeks - 1; w >= 0; w--) {
    const row: number[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = addDays(thisMonday, -w * 7 + d);
      if (iso > todayISO()) {
        row.push(0);
        continue;
      }
      const active = habits.filter((h) => (h?.createdAt ?? todayISO()) <= iso);
      const done = active.filter((h) => h?.log?.[iso]).length;
      row.push(active.length ? done / active.length : 0);
    }
    grid.push(row);
  }
  return grid;
};
