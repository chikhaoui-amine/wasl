import { todayISO, weekISO, fromISO } from "@/lib/date";
import type { BlocksPersistedState } from "../../types";
import {
  applyGooglePushResults,
  mergeGoogleEvents,
  type GoogleCalendarEvent,
  type GooglePushConfirmation,
} from "@/lib/calendar/google-sync-utils";

export interface Block {
  id: string;
  date: string; // ISO day
  start: number; // decimal hours, e.g. 9.5
  end: number;
  title: string;
  color: string;
  externalId?: string;
  externalProvider?: "google";
  updatedAt?: string;
  /** Google's `updated` timestamp at last sync; equals `updatedAt` while the block is clean. */
  externalUpdatedAt?: string;
  /** Source Google calendar when it isn't the primary one; such blocks are read-only mirrors. */
  externalCalendarId?: string;
  description?: string;
}

export type BlockInput = Omit<Block, "id">;

export function getDefaultAnchor(): string {
  return weekISO(fromISO(todayISO()))[0];
}

export function createDefaultBlocksState(): BlocksPersistedState {
  const t = todayISO();
  const nowIso = new Date().toISOString();
  return {
    blocks: [
      {
        id: "block-sample-1",
        date: t,
        start: 7.0, // 07:00
        end: 8.5,   // 08:30
        title: "Morning Routine & Physical Training",
        color: "#37c9b7",
        updatedAt: nowIso,
      },
      {
        id: "block-sample-2",
        date: t,
        start: 9.0, // 09:00
        end: 11.5,  // 11:30
        title: "Deep Work: Core System Architecture",
        color: "#7c9cf5",
        updatedAt: nowIso,
      },
      {
        id: "block-sample-3",
        date: t,
        start: 12.0, // 12:00
        end: 13.0,  // 13:00
        title: "Lunch & Recharging Walk",
        color: "#5fb36a",
        updatedAt: nowIso,
      },
      {
        id: "block-sample-4",
        date: t,
        start: 14.0, // 14:00
        end: 16.5,  // 16:30
        title: "Strategy, Learning & Synthesis",
        color: "#b57edc",
        updatedAt: nowIso,
      },
      {
        id: "block-sample-5",
        date: t,
        start: 20.5, // 20:30
        end: 21.5,  // 21:30
        title: "Evening Wind-down & Journal",
        color: "#e0a34a",
        updatedAt: nowIso,
      },
    ],
    view: "week",
    anchor: getDefaultAnchor(),
  };
}

export function normalizeBlock(raw: unknown): Block {
  if (!raw || typeof raw !== "object") {
    return {
      id: crypto.randomUUID(),
      date: todayISO(),
      start: 9,
      end: 10,
      title: "Untitled Block",
      color: "var(--accent)",
      updatedAt: new Date().toISOString(),
    };
  }

  const b = raw as Record<string, unknown>;
  return {
    id: typeof b.id === "string" && b.id ? b.id : crypto.randomUUID(),
    date: typeof b.date === "string" ? b.date : todayISO(),
    start: typeof b.start === "number" ? b.start : 9,
    end: typeof b.end === "number" ? b.end : 10,
    title: typeof b.title === "string" ? b.title : "Untitled Block",
    color: typeof b.color === "string" ? b.color : "var(--accent)",
    ...(typeof b.externalId === "string" ? { externalId: b.externalId } : {}),
    ...(b.externalProvider === "google" ? { externalProvider: "google" } : {}),
    ...(typeof b.updatedAt === "string" ? { updatedAt: b.updatedAt } : { updatedAt: new Date().toISOString() }),
    ...(typeof b.externalUpdatedAt === "string" ? { externalUpdatedAt: b.externalUpdatedAt } : {}),
    ...(typeof b.externalCalendarId === "string" && b.externalCalendarId ? { externalCalendarId: b.externalCalendarId } : {}),
    ...(typeof b.description === "string" ? { description: b.description } : {}),
  };
}

export function normalizeBlocksState(raw: unknown): BlocksPersistedState {
  if (!raw || typeof raw !== "object") {
    return createDefaultBlocksState();
  }
  const state = raw as Record<string, unknown>;
  const initialAnchor = getDefaultAnchor();
  return {
    blocks: Array.isArray(state.blocks) ? state.blocks.map(normalizeBlock) : [],
    view: state.view === "day" || state.view === "week" ? state.view : "week",
    anchor: typeof state.anchor === "string" && state.anchor ? state.anchor : initialAnchor,
    ...(typeof state.lastSyncedAt === "string" ? { lastSyncedAt: state.lastSyncedAt } : {}),
    ...(Array.isArray(state.pendingGoogleDeletes)
      ? { pendingGoogleDeletes: state.pendingGoogleDeletes.filter((id): id is string => typeof id === "string" && id.length > 0) }
      : {}),
  };
}

export function addBlockOperation(current: BlocksPersistedState, newBlock: Block): BlocksPersistedState {
  return {
    ...current,
    blocks: [...current.blocks, normalizeBlock(newBlock)],
  };
}

export function updateBlockOperation(
  current: BlocksPersistedState,
  id: string,
  patch: Partial<BlockInput>,
): BlocksPersistedState {
  return {
    ...current,
    blocks: current.blocks.map((b) => (b.id === id ? touchBlock(b, patch) : b)),
  };
}

/**
 * Applies a local edit and bumps `updatedAt` so external sync sees the change.
 * Linked blocks from before `externalUpdatedAt` existed get their pre-edit
 * timestamp recorded as the last-synced marker, so the edit is detected as unpushed.
 */
export function touchBlock(b: Block, patch: Partial<BlockInput>): Block {
  const prevUpdatedAt = b.updatedAt;
  let nextUpdatedAt = new Date().toISOString();
  if (prevUpdatedAt && nextUpdatedAt <= prevUpdatedAt) {
    nextUpdatedAt = new Date(new Date(prevUpdatedAt).getTime() + 1).toISOString();
  }
  return normalizeBlock({
    ...b,
    ...patch,
    ...(b.externalId && !b.externalUpdatedAt && prevUpdatedAt ? { externalUpdatedAt: prevUpdatedAt } : {}),
    updatedAt: nextUpdatedAt,
  });
}

/** Records the Google event id of a deleted block so the deletion can be pushed. */
export function withPendingGoogleDelete(current: BlocksPersistedState, externalId: string | undefined): BlocksPersistedState {
  if (!externalId) return current;
  const pending = current.pendingGoogleDeletes ?? [];
  if (pending.includes(externalId)) return current;
  return { ...current, pendingGoogleDeletes: [...pending, externalId] };
}

export function deleteBlockOperation(current: BlocksPersistedState, id: string): BlocksPersistedState {
  const target = current.blocks.find((b) => b.id === id);
  // Only events WASL can manage (primary calendar) are deleted in Google; mirrors of
  // other calendars and .ics imports are removed locally only.
  const googleEventId =
    target?.externalProvider === "google" && !target.externalCalendarId ? target.externalId : undefined;
  return {
    ...withPendingGoogleDelete(current, googleEventId),
    blocks: current.blocks.filter((b) => b.id !== id),
  };
}

export function setViewOperation(current: BlocksPersistedState, view: "week" | "day"): BlocksPersistedState {
  return {
    ...current,
    view,
  };
}

export function setAnchorOperation(current: BlocksPersistedState, anchor: string): BlocksPersistedState {
  return {
    ...current,
    anchor,
  };
}

/**
 * Imports blocks (e.g. from an .ics file) into the CURRENT state, replacing blocks
 * that share an id or externalId. Runs inside the serialized mutation so it never
 * clobbers edits made after the import dialog was opened.
 */
export function importBlocksOperation(current: BlocksPersistedState, imported: Block[]): BlocksPersistedState {
  const blocks = [...current.blocks];
  for (const raw of imported) {
    const block = normalizeBlock(raw);
    const idx = blocks.findIndex((b) => (b.externalId && b.externalId === block.externalId) || b.id === block.id);
    if (idx >= 0) blocks[idx] = block;
    else blocks.push(block);
  }
  return { ...current, blocks };
}

/** Merges pulled Google events into the CURRENT blocks (never a stale snapshot). */
export function mergeGoogleEventsOperation(
  current: BlocksPersistedState,
  events: GoogleCalendarEvent[],
  syncedAt: string,
): BlocksPersistedState {
  return {
    ...current,
    blocks: mergeGoogleEvents(current.blocks, events, current.pendingGoogleDeletes ?? []).map(normalizeBlock),
    lastSyncedAt: syncedAt,
  };
}

/** Records push confirmations and clears pushed deletions. */
export function applyGooglePushOperation(
  current: BlocksPersistedState,
  confirmations: GooglePushConfirmation[],
  deletedExternalIds: string[],
  syncedAt: string,
): BlocksPersistedState {
  const deleted = new Set(deletedExternalIds);
  const pending = (current.pendingGoogleDeletes ?? []).filter((id) => !deleted.has(id));
  const { pendingGoogleDeletes: _drop, ...rest } = current;
  void _drop;
  return {
    ...rest,
    blocks: applyGooglePushResults(current.blocks, confirmations).map(normalizeBlock),
    ...(pending.length > 0 ? { pendingGoogleDeletes: pending } : {}),
    lastSyncedAt: syncedAt,
  };
}

/** Clears Google link metadata, e.g. after disconnecting. Blocks themselves are kept. */
export function clearGoogleSyncStateOperation(current: BlocksPersistedState): BlocksPersistedState {
  const { pendingGoogleDeletes: _drop, ...rest } = current;
  void _drop;
  return rest;
}
