import type { Block } from "@/lib/data/domains/blocks";

export interface GoogleCalendarEvent {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  colorId?: string;
  /** iCalendar UID; matches the UID of blocks imported from an .ics export. */
  iCalUID?: string;
  /** Set by WASL's pull endpoint: the source calendar when it isn't the primary one. */
  calendarId?: string;
  /** Set by WASL's pull endpoint: the source calendar's display color. */
  calendarColor?: string;
}

const ALL_DAY_PREFIX = "[All-Day] ";

/** Window (in days before today) for pushing blocks that were never synced to Google. */
export const GOOGLE_PUSH_LOOKBACK_DAYS = 30;

function shiftIsoDate(dateStr: string, days: number): string {
  if (days === 0) return dateStr;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Converts date string and decimal hour to an ISO 8601 string.
 * Hours >= 24 (e.g. a block ending at midnight) roll over to the next day, and
 * minute rounding never produces invalid values like "09:60".
 */
export function decimalHoursToIso(dateStr: string, hourDec: number, timeZone = "UTC"): string {
  const totalMinutes = Math.max(0, Math.round(hourDec * 60));
  const dayOffset = Math.floor(totalMinutes / 1440);
  const minutesInDay = totalMinutes % 1440;
  const hrStr = String(Math.floor(minutesInDay / 60)).padStart(2, "0");
  const mStr = String(minutesInDay % 60).padStart(2, "0");
  const day = shiftIsoDate(dateStr, dayOffset);

  if (timeZone.toUpperCase() === "UTC") {
    return `${day}T${hrStr}:${mStr}:00.000Z`;
  }
  return `${day}T${hrStr}:${mStr}:00`;
}

/**
 * Parses date string and decimal hour from an ISO 8601 string.
 */
export function isoToDecimalHours(isoString: string): { date: string; hour: number } {
  const match = isoString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    const date = match[1];
    const hr = parseInt(match[2], 10);
    const min = parseInt(match[3], 10);
    const hour = Math.round((hr + min / 60) * 100) / 100;
    return { date, hour };
  }

  // Fallback to Date object parsing
  const d = new Date(isoString);
  const date = d.toISOString().slice(0, 10);
  const hour = Math.round((d.getUTCHours() + d.getUTCMinutes() / 60) * 100) / 100;
  return { date, hour };
}

/**
 * Transforms a Google Calendar Event into a WASL Block.
 * The returned block is "clean": `updatedAt === externalUpdatedAt`.
 */
export function googleEventToBlock(event: GoogleCalendarEvent, existingBlock?: Block): Block {
  const isAllDay = !event.start?.dateTime && Boolean(event.start?.date);

  let date: string;
  let start: number;
  let end: number;

  if (isAllDay && event.start?.date) {
    date = event.start.date;
    start = 9.0;
    end = 10.0;
  } else if (event.start?.dateTime) {
    const startParsed = isoToDecimalHours(event.start.dateTime);
    date = startParsed.date;
    start = startParsed.hour;
    if (event.end?.dateTime) {
      const endParsed = isoToDecimalHours(event.end.dateTime);
      if (endParsed.date > startParsed.date) {
        // Event crosses midnight: clamp to the end of the start day.
        end = 24;
      } else {
        end = endParsed.hour > start ? endParsed.hour : start + 0.5;
      }
    } else {
      end = start + 1.0;
    }
  } else {
    date = new Date().toISOString().slice(0, 10);
    start = 9.0;
    end = 10.0;
  }

  let title = event.summary?.trim() || "Untitled Block";
  if (isAllDay && !title.startsWith("[All-Day]")) {
    title = `${ALL_DAY_PREFIX}${title}`;
  }

  const updatedAt = event.updated || new Date().toISOString();

  return {
    id: existingBlock?.id || (event.id.startsWith("block-") ? event.id : `block-gcal-${event.id}`),
    date,
    start,
    end,
    title,
    color: existingBlock?.color || event.calendarColor || "#7c9cf5",
    externalId: event.id,
    externalProvider: "google",
    ...(event.calendarId ? { externalCalendarId: event.calendarId } : {}),
    updatedAt,
    externalUpdatedAt: updatedAt,
    description: event.description || "",
  };
}

/**
 * Converts a WASL Block into a Google Calendar payload.
 */
export function blockToGoogleEvent(block: Block, timeZone = "UTC"): Partial<GoogleCalendarEvent> {
  const summary = block.title.startsWith(ALL_DAY_PREFIX) ? block.title.slice(ALL_DAY_PREFIX.length) : block.title;
  return {
    summary,
    description: block.description || "",
    start: {
      dateTime: decimalHoursToIso(block.date, block.start, timeZone),
      timeZone,
    },
    end: {
      dateTime: decimalHoursToIso(block.date, Math.max(block.end, block.start + 0.25), timeZone),
      timeZone,
    },
  };
}

/** Linked to a Google event (ICS imports also carry an externalId, but it's an iCal UID). */
export function isGoogleLinked(block: Block): boolean {
  return Boolean(block.externalId) && block.externalProvider === "google";
}

/**
 * True when the block carries local changes that Google has not seen yet.
 * Blocks linked to Google are clean when `updatedAt === externalUpdatedAt`
 * (set on pull and on push confirmation). Linked blocks from before
 * `externalUpdatedAt` existed are treated as clean.
 */
export function hasUnpushedGoogleChanges(block: Block): boolean {
  // Mirrors of other calendars (class schedules, shared calendars) are read-only.
  if (block.externalCalendarId) return false;
  if (!isGoogleLinked(block)) return true;
  if (!block.externalUpdatedAt) return false;
  return block.updatedAt !== block.externalUpdatedAt;
}

/**
 * Blocks that must be pushed to Google: edited linked blocks, plus never-synced
 * blocks within the push window (so connecting doesn't flood Google with years of history).
 */
export function selectBlocksToPush(blocks: Block[], today: string): Block[] {
  const windowStart = shiftIsoDate(today, -GOOGLE_PUSH_LOOKBACK_DAYS);
  return blocks.filter((b) => {
    // Blocks imported from .ics came from another calendar; pushing them duplicates it.
    if (b.externalId && b.externalProvider !== "google") return false;
    if (!hasUnpushedGoogleChanges(b)) return false;
    if (!isGoogleLinked(b) && b.date < windowStart) return false;
    return true;
  });
}

/**
 * Pure Last-Write-Wins (LWW) merge of incoming Google Calendar events into local blocks.
 * - Remote changes win unless the local block has unpushed edits newer than the remote one.
 * - Events whose ids are in `pendingDeletes` (deleted locally, delete not yet pushed) are ignored.
 */
export function mergeGoogleEvents(
  currentBlocks: Block[],
  incomingEvents: GoogleCalendarEvent[],
  pendingDeletes: readonly string[] = [],
): Block[] {
  const skip = new Set(pendingDeletes);
  let updatedBlocks = [...currentBlocks];

  for (const event of incomingEvents) {
    if (!event?.id || skip.has(event.id)) continue;

    if (event.status === "cancelled") {
      updatedBlocks = updatedBlocks.filter((b) => !(isGoogleLinked(b) && b.externalId === event.id));
      continue;
    }

    const existingIndex = updatedBlocks.findIndex((b) => isGoogleLinked(b) && b.externalId === event.id);
    if (existingIndex < 0 && event.iCalUID) {
      // Same event already imported from an .ics file: link it instead of duplicating it.
      const adoptIndex = updatedBlocks.findIndex((b) => !isGoogleLinked(b) && b.externalId === event.iCalUID);
      if (adoptIndex >= 0) {
        updatedBlocks[adoptIndex] = googleEventToBlock(event, updatedBlocks[adoptIndex]);
        continue;
      }
    }
    if (existingIndex >= 0) {
      const existing = updatedBlocks[existingIndex];
      const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const remoteTime = event.updated ? new Date(event.updated).getTime() : 0;
      const localDirty = hasUnpushedGoogleChanges(existing);

      // Remote wins unless a newer local edit is still waiting to be pushed.
      if (!localDirty || remoteTime >= localTime) {
        updatedBlocks[existingIndex] = googleEventToBlock(event, existing);
      } else {
        // Keep the local edit, but remember the latest remote version we've seen.
        updatedBlocks[existingIndex] = { ...existing, externalUpdatedAt: event.updated ?? existing.externalUpdatedAt };
      }
    } else {
      updatedBlocks.push(googleEventToBlock(event));
    }
  }

  return updatedBlocks;
}

export interface GooglePushConfirmation {
  id: string;
  externalId: string;
  updatedAt: string;
  /** The block's `updatedAt` at the moment it was sent. */
  sentUpdatedAt?: string;
}

/**
 * Applies push confirmations to the CURRENT block list. Blocks edited again while
 * the push was in flight keep their newer `updatedAt` so they stay dirty and get
 * pushed on the next cycle.
 */
export function applyGooglePushResults(currentBlocks: Block[], confirmations: GooglePushConfirmation[]): Block[] {
  if (confirmations.length === 0) return currentBlocks;
  const byId = new Map(confirmations.map((c) => [c.id, c]));
  return currentBlocks.map((b) => {
    const c = byId.get(b.id);
    if (!c) return b;
    const editedSinceSend = c.sentUpdatedAt !== undefined && b.updatedAt !== c.sentUpdatedAt;
    return {
      ...b,
      externalId: c.externalId,
      externalProvider: "google" as const,
      externalUpdatedAt: c.updatedAt,
      updatedAt: editedSinceSend ? b.updatedAt : c.updatedAt,
    };
  });
}
