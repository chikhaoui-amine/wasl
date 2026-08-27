import type { DataAdapter } from "../../types";
import {
  normalizeTrashState,
  moveToTrashOperation,
  restoreItemOperation,
  type TrashItem,
  type TrashItemType,
} from "./operations";
import { normalizeTasksState, type Task } from "../tasks";
import { normalizeNotesState, type Note } from "../notes";
import { normalizeGoalsState, type Goal } from "../goals";
import { normalizeHabitsState, type Habit } from "../habits";
import { normalizeHealthState, DEFAULT_PROGRAMS, type Workout, type WorkoutProgram } from "../health";

export class TrashConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrashConflictError";
  }
}

/**
 * Executes a safe, two-step deletion:
 * 1. Writes the entity to lifeos-trash first.
 * 2. Deletes the entity from the source store only after Trash write succeeds.
 *
 * If Trash write fails, the source entity is untouched and preserved.
 * If source deletion fails after Trash succeeds, both copies remain as a recoverable duplicate.
 */
export async function deleteEntityWithTrash(
  adapter: DataAdapter,
  options: {
    itemType: TrashItemType;
    entity: { id: string; title?: string };
    title?: string;
    description?: string;
    originalStoreKey: string;
    deleteFromSource: (adapter: DataAdapter) => Promise<void>;
  },
): Promise<TrashItem> {
  const stableTrashId = `trash-${options.itemType}-${options.entity.id}`;
  const title = options.title || (typeof options.entity.title === "string" ? options.entity.title : "Untitled");

  const trashItem: TrashItem = {
    id: stableTrashId,
    itemType: options.itemType,
    title,
    description: options.description,
    itemData: options.entity,
    deletedAt: new Date().toISOString(),
    originalStoreKey: options.originalStoreKey,
  };

  // Step 1: Write to Trash store first
  await adapter.mutateStore("lifeos-trash", (prev) => {
    const base = normalizeTrashState(prev);
    return moveToTrashOperation(base, trashItem);
  });

  // Step 2: Delete from source store only after Trash succeeds
  await options.deleteFromSource(adapter);

  return trashItem;
}

/**
 * Executes a safe, two-step restoration:
 * 1. Restores the entity to its destination store first (verifying no conflicting ID already exists).
 * 2. Removes the item from lifeos-trash only after destination write succeeds.
 *
 * If destination write fails or conflicts, the Trash item is preserved.
 * If Trash removal fails after destination write succeeds, both copies remain as a recoverable duplicate.
 */
export async function restoreEntityFromTrash(
  adapter: DataAdapter,
  trashItemId: string,
): Promise<void> {
  const trashDoc = await adapter.getStore("lifeos-trash");
  const trashState = normalizeTrashState(trashDoc?.state);
  const item = trashState.items.find((i) => i.id === trashItemId);

  if (!item) {
    throw new Error(`Trash item with ID ${trashItemId} not found.`);
  }

  const rawData = item.itemData;
  if (!rawData || typeof rawData !== "object" || !("id" in rawData)) {
    throw new Error(`Invalid or corrupt item data for trash item ${trashItemId}.`);
  }
  const data = rawData as { id: string };

  // Step 1: Restore to destination store
  switch (item.itemType) {
    case "task": {
      await adapter.mutateStore("lifeos-tasks", (prev) => {
        const base = normalizeTasksState(prev);
        if (base.tasks.some((t) => t.id === data.id)) {
          throw new TrashConflictError(`A task with ID "${data.id}" already exists.`);
        }
        return {
          ...base,
          tasks: [data as Task, ...base.tasks],
        };
      });
      break;
    }

    case "note": {
      await adapter.mutateStore("lifeos-notes", (prev) => {
        const base = normalizeNotesState(prev);
        if (base.notes.some((n) => n.id === data.id)) {
          throw new TrashConflictError(`A note with ID "${data.id}" already exists.`);
        }
        return {
          ...base,
          notes: [data as Note, ...base.notes],
        };
      });
      break;
    }

    case "goal": {
      await adapter.mutateStore("lifeos-goals", (prev) => {
        const base = normalizeGoalsState(prev);
        if (base.goals.some((g) => g.id === data.id)) {
          throw new TrashConflictError(`A goal with ID "${data.id}" already exists.`);
        }
        return {
          ...base,
          goals: [data as Goal, ...base.goals],
        };
      });
      break;
    }

    case "habit": {
      await adapter.mutateStore("lifeos-habits", (prev) => {
        const base = normalizeHabitsState(prev);
        if (base.habits.some((h) => h.id === data.id)) {
          throw new TrashConflictError(`A habit with ID "${data.id}" already exists.`);
        }
        return {
          ...base,
          habits: [data as Habit, ...base.habits],
        };
      });
      break;
    }

    case "program": {
      await adapter.mutateStore("lifeos-health", (prev) => {
        const base = normalizeHealthState(prev);
        if (base.programs.some((p) => p.id === data.id)) {
          throw new TrashConflictError(`A workout program with ID "${data.id}" already exists.`);
        }
        return {
          ...base,
          programs: [...base.programs, data as WorkoutProgram],
        };
      });
      break;
    }

    case "workout": {
      await adapter.mutateStore("lifeos-health", (prev) => {
        const base = normalizeHealthState(prev);
        if (base.workouts.some((w) => w.id === data.id)) {
          throw new TrashConflictError(`A workout with ID "${data.id}" already exists.`);
        }
        return {
          ...base,
          workouts: [data as Workout, ...base.workouts],
        };
      });
      break;
    }

    default: {
      const unsupportedType = (item as { itemType: string }).itemType;
      throw new Error(`Unsupported trash item type: ${unsupportedType}`);
    }
  }

  // Step 2: Remove from Trash store only after destination succeeds
  await adapter.mutateStore("lifeos-trash", (prev) => {
    const base = normalizeTrashState(prev);
    return restoreItemOperation(base, trashItemId);
  });
}

/**
 * Restores default programs to health state if missing.
 */
export async function restoreDefaultProgramsService(adapter: DataAdapter): Promise<void> {
  await adapter.mutateStore("lifeos-health", (prev) => {
    const base = normalizeHealthState(prev);
    const existingIds = new Set(base.programs.map((p) => p.id));
    const missing = DEFAULT_PROGRAMS.filter((p) => !existingIds.has(p.id));
    const toAdd = missing.length > 0 ? missing : DEFAULT_PROGRAMS;
    return {
      ...base,
      programs: [...base.programs, ...toAdd],
    };
  });
}
