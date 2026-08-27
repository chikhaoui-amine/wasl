import type { WaslEdition } from "./edition";
import type { StoreKey } from "./store-registry";

export type { StoreKey };

// Domain entity imports from active store definitions
import type { Note, NoteCategory } from "./domains/notes";
import type { TrashItem } from "./domains/trash";
import type { HealthDay, Workout, WorkoutProgram, ActiveWorkout, Exercise } from "./domains/health";
import type { Topic } from "./domains/topics";
import type { Goal } from "./domains/goals";
import type { Task } from "./domains/tasks";
import type { DailyFocus } from "@/lib/tasks/focus";
import type { Block } from "./domains/blocks";
import type { JournalEntry } from "./domains/journal";
import type { Habit } from "./domains/habits";
import type { Txn, SavingsGoal } from "./domains/money";
import type { RecurringTask } from "./domains/recurring";

/**
 * Concrete persisted state interface for Notes.
 */
export interface NotesPersistedState {
  notes: Note[];
  categories: NoteCategory[];
}

/**
 * Concrete persisted state interface for Trash.
 */
export interface TrashPersistedState {
  items: TrashItem[];
}

/**
 * Concrete persisted state interface for Health.
 */
export interface HealthPersistedState {
  days: Record<string, HealthDay>;
  workouts: Workout[];
  customSports?: string[];
  exercises?: Exercise[];
  programs: WorkoutProgram[];
  goals?: { steps: number; waterCups: number; sleepH: number; sessionsPerWeek: number };
  activeWorkout: ActiveWorkout | null;
}

/**
 * Concrete persisted state interface for Topics.
 */
export interface TopicsPersistedState {
  topics: Topic[];
}

/**
 * Concrete persisted state interface for Goals.
 */
export interface GoalsPersistedState {
  goals: Goal[];
}

/**
 * Concrete persisted state interface for Tasks.
 */
export interface TasksPersistedState {
  tasks: Task[];
  dailyFocus: DailyFocus;
}

/**
 * Concrete persisted state interface for Time Blocks.
 */
export interface BlocksPersistedState {
  blocks: Block[];
  view: "week" | "day";
  anchor: string;
}

/**
 * Concrete persisted state interface for Journal.
 */
export interface JournalPersistedState {
  entries: JournalEntry[];
}

/**
 * Concrete persisted state interface for Habits.
 */
export interface HabitsPersistedState {
  habits: Habit[];
}

/**
 * Concrete persisted state interface for Money.
 */
export interface MoneyPersistedState {
  currency: string;
  transactions: Txn[];
  savings: SavingsGoal[];
}

/**
 * Concrete persisted state interface for Recurring Tasks.
 */
export interface RecurringPersistedState {
  recurring: RecurringTask[];
}

/**
 * Persisted state map mapping each active StoreKey to its concrete persisted state type.
 * Does not use any, unknown, or generic record fallbacks for active stores.
 * Archived stores (lifeos-projects, lifeos-routines, lifeos-reviews) are strictly excluded from StoreKey.
 */
export interface StoreStateMap {
  "lifeos-notes": NotesPersistedState;
  "lifeos-trash": TrashPersistedState;
  "lifeos-health": HealthPersistedState;
  "lifeos-topics": TopicsPersistedState;
  "lifeos-goals": GoalsPersistedState;
  "lifeos-tasks": TasksPersistedState;
  "lifeos-blocks": BlocksPersistedState;
  "lifeos-journal": JournalPersistedState;
  "lifeos-habits": HabitsPersistedState;
  "lifeos-money": MoneyPersistedState;
  "lifeos-recurring": RecurringPersistedState;
}

/**
 * Canonical document format for persisting a single domain store snapshot.
 * Used across Local (IndexedDB/Dexie) and Portable Backups.
 */
export interface StoreDocument<K extends StoreKey = StoreKey> {
  store: K;
  version: number;
  state: StoreStateMap[K];
  updatedAt: string;
  revision?: number;
}

/**
 * Standard DataAdapter contract implemented by persistence adapter.
 * Components interact strictly through this interface or hooks, never querying Dexie directly.
 */
export interface DataAdapter {
  readonly edition: WaslEdition;

  /** Initialize connection, run non-destructive migrations, ensure tables/stores exist. */
  initialize(): Promise<void>;

  /** Fetch the current document for a specific domain store. */
  getStore<K extends StoreKey>(store: K): Promise<StoreDocument<K> | null>;

  /** Upsert a store document atomically. */
  putStore<K extends StoreKey>(document: StoreDocument<K>): Promise<StoreDocument<K>>;

  /** Perform a transactional mutation on a store state. */
  mutateStore<K extends StoreKey>(
    store: K,
    mutation: (state: StoreStateMap[K]) => StoreStateMap[K],
  ): Promise<StoreDocument<K>>;

  /** Retrieve all active domain store documents. */
  getAllStores(): Promise<StoreDocument<StoreKey>[]>;

  /** Subscribe to storage change events (for cross-tab or remote invalidation). Returns unsubscribe function. */
  subscribe(listener: (storeKey?: StoreKey) => void): () => void;
}

/**
 * Canonical Portable Backup format supported by both Local and Cloud editions.
 */
export interface WaslBackup {
  format: "wasl-portable-backup";
  formatVersion: 1;
  appVersion: string;
  exportedAt: string;
  sourceEdition: WaslEdition;
  stores: StoreDocument<StoreKey>[];
  preferences?: Record<string, unknown>;
  checksum: string;
}

/**
 * Summary information displayed to the user prior to executing an import.
 */
export interface BackupPreview {
  valid: boolean;
  appVersion: string;
  exportedAt: string;
  sourceEdition: WaslEdition;
  storeCount: number;
  stores: {
    store: StoreKey;
    version: number;
    entityCount?: number;
  }[];
  warnings: string[];
  errors: string[];
}

/**
 * Resolution strategies for duplicate IDs during selective transfer import.
 */
export type DuplicateResolutionStrategy = "skip" | "replace" | "copy";

/**
 * Scope of domains or specific entities selected for export in a selective transfer.
 */
export interface WaslTransferSelection {
  domains?: StoreKey[];
  entities?: Partial<Record<StoreKey, string[]>>;
}

/**
 * Canonical Selective Transfer package (.wasl-transfer) supported by both Local and Cloud editions.
 */
export interface WaslTransfer {
  format: "wasl-selective-transfer";
  formatVersion: 1;
  appVersion: string;
  exportedAt: string;
  sourceEdition: WaslEdition;
  selection: WaslTransferSelection;
  stores: StoreDocument<StoreKey>[];
  preferences?: Record<string, unknown>;
  checksum: string;
}

/**
 * Detailed preview information generated from a .wasl-transfer file prior to merging.
 */
export interface TransferStoreDetail {
  store: StoreKey;
  version: number;
  totalEntities: number;
  duplicateCount: number;
  newCount: number;
  duplicateEntityIds: string[];
}

export interface TransferPreviewDetails {
  valid: boolean;
  appVersion: string;
  exportedAt: string;
  sourceEdition: WaslEdition;
  storeCount: number;
  totalEntitiesCount: number;
  stores: TransferStoreDetail[];
  dependencyWarnings: string[];
  warnings: string[];
  errors: string[];
  transfer?: WaslTransfer;
}
