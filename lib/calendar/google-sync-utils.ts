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
}

/**
 * Converts date string and decimal hour to an ISO 8601 string.
 */
export function decimalHoursToIso(dateStr: string, hourDec: number, timeZone = "UTC"): string {
  const hr = Math.floor(hourDec);
  const m = Math.round((hourDec - hr) * 60);
  const hrStr = String(hr).padStart(2, "0");
  const mStr = String(m).padStart(2, "0");

  if (timeZone.toUpperCase() === "UTC") {
    return `${dateStr}T${hrStr}:${mStr}:00.000Z`;
  }
  return `${dateStr}T${hrStr}:${mStr}:00`;
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
      end = endParsed.hour > start ? endParsed.hour : start + 0.5;
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
    title = `[All-Day] ${title}`;
  }

  return {
    id: existingBlock?.id || (event.id.startsWith("block-") ? event.id : `block-gcal-${event.id}`),
    date,
    start,
    end,
    title,
    color: existingBlock?.color || "#7c9cf5",
    externalId: event.id,
    externalProvider: "google",
    updatedAt: event.updated || new Date().toISOString(),
    description: event.description || "",
  };
}

/**
 * Converts a WASL Block into a Google Calendar payload.
 */
export function blockToGoogleEvent(block: Block, timeZone = "UTC"): Partial<GoogleCalendarEvent> {
  return {
    ...(block.externalId ? { id: block.externalId } : {}),
    summary: block.title,
    description: block.description || "",
    start: {
      dateTime: decimalHoursToIso(block.date, block.start, timeZone),
      timeZone,
    },
    end: {
      dateTime: decimalHoursToIso(block.date, block.end, timeZone),
      timeZone,
    },
  };
}

/**
 * Pure Last-Write-Wins (LWW) merge of incoming Google Calendar events into local blocks.
 */
export function mergeGoogleEvents(currentBlocks: Block[], incomingEvents: GoogleCalendarEvent[]): Block[] {
  let updatedBlocks = [...currentBlocks];

  for (const event of incomingEvents) {
    if (event.status === "cancelled") {
      updatedBlocks = updatedBlocks.filter((b) => b.externalId !== event.id);
      continue;
    }

    const existingIndex = updatedBlocks.findIndex((b) => b.externalId === event.id);
    if (existingIndex >= 0) {
      const existing = updatedBlocks[existingIndex];
      const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const remoteTime = event.updated ? new Date(event.updated).getTime() : 0;

      // Remote wins if newer or equal; otherwise retain local edit
      if (remoteTime >= localTime) {
        updatedBlocks[existingIndex] = googleEventToBlock(event, existing);
      }
    } else {
      updatedBlocks.push(googleEventToBlock(event));
    }
  }

  return updatedBlocks;
}
