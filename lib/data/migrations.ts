/**
 * lib/data/migrations.ts
 *
 * Central, non-destructive migration registry.
 *
 * Every active domain store registers a pure `(oldVersion, oldState) => newState`
 * function here. The registry is injected into both LocalAdapter and CloudAdapter
 * (see DataProvider), so a snapshot persisted by an older app version is migrated
 * in memory on read — never silently skipped, never destructively reset.
 *
 * NOTE: domain migrators historically have signature (rawState, fromVersion)
 * while the adapter contract is (oldVersion, oldState). Each entry below wraps
 * its domain function with the correct explicit argument order so the two
 * conventions can never be silently confused again.
 *
 * Rules for adding a store:
 * - Prefer the domain's own `migrateXSnapshot` (version-aware).
 * - Fall back to the domain's state normalizer when legacy shapes coerce cleanly.
 * - NEVER return empty data on version mismatch: unknown fields pass through.
 */
import type { StoreKey } from "./types";

export type MigrationRegistry = Partial<Record<StoreKey, (oldVersion: number, oldState: unknown) => unknown>>;

import { migrateTasksSnapshot } from "./domains/tasks/migrations";
import { migrateNotesSnapshot } from "./domains/notes/migrations";
import { migrateGoalsSnapshot } from "./domains/goals/migrations";
import { migrateBlocksSnapshot } from "./domains/blocks/migrations";
import { migrateTopicsSnapshot } from "./domains/topics/migrations";
import { migrateHabitsSnapshot } from "./domains/habits/migrations";
import { migrateHealthSnapshot } from "./domains/health/migrations";
import { migrateRecurringSnapshot } from "./domains/recurring/migrations";
import { migrateTrashSnapshot } from "./domains/trash/migrations";
import { normalizeJournalState } from "./domains/journal/operations";
import { normalizeMoneyState } from "./domains/money/operations";

export const DOMAIN_MIGRATIONS: MigrationRegistry = {
  "lifeos-tasks": (v, s) => migrateTasksSnapshot(s, v),
  "lifeos-notes": (v, s) => migrateNotesSnapshot(s, v),
  "lifeos-goals": (v, s) => migrateGoalsSnapshot(s, v),
  "lifeos-blocks": (v, s) => migrateBlocksSnapshot(s, v),
  "lifeos-topics": (v, s) => migrateTopicsSnapshot(s, v),
  "lifeos-habits": (v, s) => migrateHabitsSnapshot(s, v),
  "lifeos-health": (v, s) => migrateHealthSnapshot(s, v),
  "lifeos-recurring": (v, s) => migrateRecurringSnapshot(s, v),
  "lifeos-trash": (v, s) => migrateTrashSnapshot(s, v),
  "lifeos-journal": (_v, s) => normalizeJournalState(s),
  "lifeos-money": (_v, s) => normalizeMoneyState(s),
};
