/**
 * Authoritative registry of active persisted domain stores in WASL / LifeOS.
 * Versions match the existing runtime schema versions in the codebase.
 */
export const STORE_REGISTRY = {
  "lifeos-notes": { version: 3, name: "Notes", description: "Rich notes, categories, and references" },
  "lifeos-trash": { version: 1, name: "Trash", description: "Unified soft-deletion repository" },
  "lifeos-health": { version: 6, name: "Health", description: "Workouts, programs, exercises, bodyweight, metrics" },
  "lifeos-topics": { version: 4, name: "Learning Topics", description: "Topic maps, units, resources, and progress" },
  "lifeos-goals": { version: 6, name: "Goals", description: "Quarterly and annual goals, milestones, and categories" },
  "lifeos-tasks": { version: 3, name: "Tasks", description: "Daily tasks, priorities, timeframes, and focuses" },
  "lifeos-blocks": { version: 3, name: "Time Blocks", description: "Time-blocking schedule and daily segments" },
  "lifeos-journal": { version: 2, name: "Journal", description: "Daily journal entries, prompts, and reflections" },
  "lifeos-habits": { version: 4, name: "Habits", description: "Habit streaks, targets, colors, and weekly logs" },
  "lifeos-money": { version: 4, name: "Money", description: "Transactions, recurring expenses, and accounts" },
  "lifeos-recurring": { version: 1, name: "Recurring Tasks", description: "Recurring task templates and cadence" },
} as const;

export type StoreKey = keyof typeof STORE_REGISTRY;

export const STORE_KEYS = Object.keys(STORE_REGISTRY) as StoreKey[];

/** Canonical active-store count. Consumers must not count physical snapshots. */
export const ACTIVE_STORE_COUNT = STORE_KEYS.length;

export const STORE_METADATA = STORE_REGISTRY;

/**
 * Stores that have been deprecated or removed from the active codebase.
 * Their historical snapshots are preserved in backups but never loaded as active features.
 */
export const ARCHIVED_STORES = [
  "lifeos-projects",
  "lifeos-routines",
  "lifeos-reviews",
  "lifeos-deen",
] as const;

export type ArchivedStoreKey = (typeof ARCHIVED_STORES)[number];

export type StoreLifecycle = "active" | "archived" | "unknown";

/**
 * Returns true if the given key is a registered active domain store.
 */
export function isStoreKey(key: string): key is StoreKey {
  return Object.prototype.hasOwnProperty.call(STORE_REGISTRY, key);
}

/**
 * Returns true if the given key is an archived store.
 */
export function isArchivedStoreKey(key: string): key is ArchivedStoreKey {
  return (ARCHIVED_STORES as readonly string[]).includes(key);
}

/** Classify persisted snapshot names without ever promoting legacy data. */
export function getStoreLifecycle(key: string): StoreLifecycle {
  if (isStoreKey(key)) return "active";
  if (isArchivedStoreKey(key)) return "archived";
  return "unknown";
}

/**
 * Returns the expected schema version for an active domain store.
 */
export function getStoreVersion(key: StoreKey): number {
  return STORE_REGISTRY[key].version;
}
