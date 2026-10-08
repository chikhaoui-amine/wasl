import type { Block } from "@/lib/data/domains/blocks";

/**
 * Escapes text according to RFC 5545 iCalendar specification.
 */
function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Unescapes RFC 5545 text.
 */
function unescapeIcsText(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * Converts date string (YYYY-MM-DD) and decimal hour to an RFC 5545 UTC date-time string (YYYYMMDDTHHMMSSZ).
 */
function decimalHoursToIcsDateTime(dateStr: string, hourDec: number): string {
  const dClean = dateStr.replace(/-/g, "");
  const hr = Math.floor(hourDec);
  const m = Math.round((hourDec - hr) * 60);
  const hrStr = String(Math.max(0, Math.min(23, hr))).padStart(2, "0");
  const mStr = String(Math.max(0, Math.min(59, m))).padStart(2, "0");
  return `${dClean}T${hrStr}${mStr}00Z`;
}

/**
 * Formats an ISO timestamp (or now) as an RFC 5545 UTC date-time string.
 */
function isoToIcsDateTime(isoString?: string): string {
  const d = isoString ? new Date(isoString) : new Date();
  if (isNaN(d.getTime())) {
    return new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  }
  return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}

/**
 * Parses an RFC 5545 date-time string (e.g. 20261008T120000Z) into an ISO 8601 string.
 */
function icsDateTimeToIso(icsDt: string): string {
  const match = icsDt.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (match) {
    const isUtc = match[7] === "Z";
    return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.000${isUtc ? "Z" : ""}`;
  }
  const d = new Date(icsDt);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Unfolds multiline RFC 5545 folded lines (lines starting with space or tab).
 */
function unfoldIcsLines(raw: string): string[] {
  const rawLines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }

  return lines;
}

/**
 * Parses an RFC 5545 date-time or date-only string into { date: YYYY-MM-DD, hour: number, isDateOnly: boolean }.
 */
function parseIcsDateTime(
  rawProp: string,
  rawVal: string,
): { date: string; hour: number; isDateOnly: boolean } | null {
  const isDateOnly = rawProp.toUpperCase().includes("VALUE=DATE") || /^\d{8}$/.test(rawVal.trim());

  if (isDateOnly) {
    const val = rawVal.trim();
    if (val.length >= 8) {
      const date = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
      return { date, hour: 9.0, isDateOnly: true };
    }
    return null;
  }

  const match = rawVal.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (match) {
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    const hr = parseInt(match[4], 10);
    const min = parseInt(match[5], 10);
    const hour = Math.round((hr + min / 60) * 100) / 100;
    return { date, hour, isDateOnly: false };
  }

  return null;
}

/**
 * Serializes a collection of WASL blocks into an RFC 5545 iCalendar string.
 */
export function exportBlocksToIcs(blocks: Block[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WASL//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const block of blocks) {
    const uid = block.externalId || (block.id.includes("@") ? block.id : `${block.id}@wasl.app`);
    const dtstamp = isoToIcsDateTime(block.updatedAt);
    const dtstart = decimalHoursToIcsDateTime(block.date, block.start);
    const dtend = decimalHoursToIcsDateTime(block.date, block.end);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:${escapeIcsText(block.title)}`);

    if (block.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(block.description)}`);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/**
 * Parses an RFC 5545 iCalendar string into WASL blocks.
 */
export function parseIcsToBlocks(icsContent: string): Block[] {
  const lines = unfoldIcsLines(icsContent);
  const blocks: Block[] = [];

  let inEvent = false;
  let currentUid = "";
  let currentSummary = "";
  let currentDescription = "";
  let currentDtStamp = "";
  let startDateInfo: { date: string; hour: number; isDateOnly: boolean } | null = null;
  let endDateInfo: { date: string; hour: number; isDateOnly: boolean } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      currentUid = "";
      currentSummary = "";
      currentDescription = "";
      currentDtStamp = "";
      startDateInfo = null;
      endDateInfo = null;
      continue;
    }

    if (line === "END:VEVENT") {
      if (inEvent && startDateInfo) {
        const isAllDay = startDateInfo.isDateOnly;
        let title = currentSummary ? unescapeIcsText(currentSummary).trim() : "Untitled Block";
        if (isAllDay && !title.startsWith("[All-Day]")) {
          title = `[All-Day] ${title}`;
        }

        const date = startDateInfo.date;
        const start = startDateInfo.hour;
        let end = endDateInfo ? endDateInfo.hour : start + 1.0;
        if (end <= start) end = start + 1.0;

        const id = currentUid.replace(/@wasl\.app$/, "");

        blocks.push({
          id: id.startsWith("block-") ? id : `block-ics-${id || Math.random().toString(36).slice(2, 9)}`,
          date,
          start,
          end,
          title,
          description: currentDescription ? unescapeIcsText(currentDescription) : "",
          color: "#7c9cf5",
          externalId: currentUid || undefined,
          updatedAt: currentDtStamp ? icsDateTimeToIso(currentDtStamp) : new Date().toISOString(),
        });
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const prop = line.slice(0, colonIdx);
    const val = line.slice(colonIdx + 1);
    const propName = prop.split(";")[0].toUpperCase();

    switch (propName) {
      case "UID":
        currentUid = val;
        break;
      case "SUMMARY":
        currentSummary = val;
        break;
      case "DESCRIPTION":
        currentDescription = val;
        break;
      case "DTSTAMP":
        currentDtStamp = val;
        break;
      case "DTSTART":
        startDateInfo = parseIcsDateTime(prop, val);
        break;
      case "DTEND":
        endDateInfo = parseIcsDateTime(prop, val);
        break;
    }
  }

  return blocks;
}
