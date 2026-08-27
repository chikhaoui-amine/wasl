import type { TrashPersistedState } from "../../types";
import type { Note } from "../notes";
import type { Goal } from "../goals";
import type { Task } from "../tasks";
import type { Habit } from "../habits";
import type { Workout, WorkoutProgram } from "../health";

export type TrashItemType =
  | "program"
  | "workout"
  | "task"
  | "note"
  | "goal"
  | "habit";

export type TrashedEntityData =
  | { type: "program"; data: WorkoutProgram }
  | { type: "workout"; data: Workout }
  | { type: "task"; data: Task }
  | { type: "note"; data: Note }
  | { type: "goal"; data: Goal }
  | { type: "habit"; data: Habit };

export interface TrashItem {
  id: string;
  itemType: TrashItemType;
  title: string;
  description?: string;
  itemData: unknown; // Concrete entity payload
  deletedAt: string;
  originalStoreKey: string;
}

export interface TrashItemInput {
  id?: string;
  itemType: TrashItemType;
  title: string;
  description?: string;
  itemData: unknown;
  originalStoreKey: string;
  deletedAt?: string;
}

export function createDefaultTrashState(): TrashPersistedState {
  return {
    items: [],
  };
}

export function normalizeTrashItem(raw: unknown): TrashItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<TrashItem>;

  if (typeof item.id !== "string" || !item.id) return null;
  if (
    item.itemType !== "program" &&
    item.itemType !== "workout" &&
    item.itemType !== "task" &&
    item.itemType !== "note" &&
    item.itemType !== "goal" &&
    item.itemType !== "habit"
  ) {
    return null;
  }
  if (typeof item.title !== "string") return null;
  if (!item.itemData || typeof item.itemData !== "object") return null;

  return {
    id: item.id,
    itemType: item.itemType,
    title: item.title.trim() || "Untitled Trashed Item",
    description: typeof item.description === "string" ? item.description : undefined,
    itemData: item.itemData,
    deletedAt: typeof item.deletedAt === "string" ? item.deletedAt : new Date().toISOString(),
    originalStoreKey:
      typeof item.originalStoreKey === "string" && item.originalStoreKey
        ? item.originalStoreKey
        : `lifeos-${item.itemType === "program" || item.itemType === "workout" ? "health" : `${item.itemType}s`}`,
  };
}

export function normalizeTrashState(raw: unknown): TrashPersistedState {
  if (!raw || typeof raw !== "object") {
    return createDefaultTrashState();
  }

  const s = raw as Partial<TrashPersistedState>;
  const items = Array.isArray(s.items)
    ? s.items
        .map(normalizeTrashItem)
        .filter((i): i is TrashItem => i !== null)
    : [];

  return {
    items,
  };
}

export function moveToTrashOperation(
  current: TrashPersistedState | null | undefined,
  item: TrashItem,
): TrashPersistedState {
  const items = Array.isArray(current?.items) ? current.items : [];
  // Idempotent by item.id
  const existingIdx = items.findIndex((i) => i.id === item.id);
  if (existingIdx >= 0) {
    const updated = [...items];
    updated[existingIdx] = item;
    return { items: updated };
  }

  return {
    items: [item, ...items],
  };
}

export function restoreItemOperation(
  current: TrashPersistedState | null | undefined,
  id: string,
): TrashPersistedState {
  const items = Array.isArray(current?.items) ? current.items : [];
  return {
    items: items.filter((item) => item.id !== id),
  };
}

export function deletePermanentlyOperation(
  current: TrashPersistedState | null | undefined,
  id: string,
): TrashPersistedState {
  const items = Array.isArray(current?.items) ? current.items : [];
  return {
    items: items.filter((item) => item.id !== id),
  };
}

export function emptyTrashOperation(): TrashPersistedState {
  return {
    items: [],
  };
}
