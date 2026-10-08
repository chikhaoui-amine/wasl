import { describe, it, expect } from "vitest";
import type { Block } from "@/lib/data/domains/blocks";
import { exportBlocksToIcs, parseIcsToBlocks } from "./ics-utils";

describe("ics-utils (RFC 5545 iCalendar)", () => {
  const sampleBlocks: Block[] = [
    {
      id: "block-1",
      date: "2026-10-08",
      start: 9.5, // 09:30
      end: 11.0, // 11:00
      title: "Team Standup, Strategy & Planning",
      description: "Discuss Q4 roadmaps;\nReview PRs and milestones.",
      color: "#7c9cf5",
      updatedAt: "2026-10-08T09:00:00.000Z",
    },
    {
      id: "block-2",
      date: "2026-10-09",
      start: 14.0, // 14:00
      end: 15.25, // 15:15
      title: "Deep Work: Core Architecture",
      color: "#34d399",
      externalId: "ext-12345",
      updatedAt: "2026-10-08T10:00:00.000Z",
    },
  ];

  describe("exportBlocksToIcs", () => {
    it("generates a valid VCALENDAR envelope with VEVENT entries", () => {
      const ics = exportBlocksToIcs(sampleBlocks);

      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("VERSION:2.0");
      expect(ics).toContain("PRODID:-//WASL//Calendar//EN");
      expect(ics).toContain("CALSCALE:GREGORIAN");
      expect(ics).toContain("END:VCALENDAR");

      // Verify block-1 event
      expect(ics).toContain("BEGIN:VEVENT");
      expect(ics).toContain("UID:block-1@wasl.app");
      expect(ics).toContain("DTSTART:20261008T093000Z");
      expect(ics).toContain("DTEND:20261008T110000Z");
      expect(ics).toContain("SUMMARY:Team Standup\\, Strategy & Planning");
      expect(ics).toContain("DESCRIPTION:Discuss Q4 roadmaps\\;\\nReview PRs and milestones.");

      // Verify block-2 event using existing externalId
      expect(ics).toContain("UID:ext-12345");
      expect(ics).toContain("DTSTART:20261009T140000Z");
      expect(ics).toContain("DTEND:20261009T151500Z");
      expect(ics).toContain("SUMMARY:Deep Work: Core Architecture");
    });

    it("handles empty blocks array gracefully", () => {
      const ics = exportBlocksToIcs([]);
      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("END:VCALENDAR");
      expect(ics).not.toContain("BEGIN:VEVENT");
    });
  });

  describe("parseIcsToBlocks", () => {
    it("parses valid VEVENT entries with date-time UTC strings", () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//External//Calendar//EN
BEGIN:VEVENT
UID:event-123
DTSTAMP:20261008T120000Z
DTSTART:20261010T083000Z
DTEND:20261010T100000Z
SUMMARY:Design Review\\, Sprint 4
DESCRIPTION:Review wireframes\\;\\nFinalize tokens
END:VEVENT
END:VCALENDAR`;

      const blocks = parseIcsToBlocks(icsData);
      expect(blocks).toHaveLength(1);
      const b = blocks[0];
      expect(b.date).toBe("2026-10-10");
      expect(b.start).toBe(8.5); // 08:30
      expect(b.end).toBe(10.0);
      expect(b.title).toBe("Design Review, Sprint 4");
      expect(b.description).toBe("Review wireframes;\nFinalize tokens");
      expect(b.externalId).toBe("event-123");
    });

    it("unfolds long folded lines correctly per RFC 5545", () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:folded-event
DTSTART:20261012T090000Z
DTEND:20261012T100000Z
SUMMARY:A very long title that was split across mult
 iple lines according to RFC 5545 folding rules
END:VEVENT
END:VCALENDAR`;

      const blocks = parseIcsToBlocks(icsData);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].title).toBe("A very long title that was split across multiple lines according to RFC 5545 folding rules");
    });

    it("handles all-day events (VALUE=DATE)", () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:allday-event
DTSTART;VALUE=DATE:20261015
DTEND;VALUE=DATE:20261016
SUMMARY:Hackathon Day
END:VEVENT
END:VCALENDAR`;

      const blocks = parseIcsToBlocks(icsData);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].date).toBe("2026-10-15");
      expect(blocks[0].start).toBe(9.0);
      expect(blocks[0].end).toBe(10.0);
      expect(blocks[0].title).toBe("[All-Day] Hackathon Day");
    });

    it("handles local floating date-time without Z suffix", () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:floating-time
DTSTART:20261018T144500
DTEND:20261018T161500
SUMMARY:Floating Time Event
END:VEVENT
END:VCALENDAR`;

      const blocks = parseIcsToBlocks(icsData);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].date).toBe("2026-10-18");
      expect(blocks[0].start).toBe(14.75); // 14:45
      expect(blocks[0].end).toBe(16.25); // 16:15
    });

    it("ignores non-event blocks such as VTIMEZONE", () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Europe/London
END:VTIMEZONE
BEGIN:VEVENT
UID:event-after-tz
DTSTART:20261020T100000Z
DTEND:20261020T110000Z
SUMMARY:London Meeting
END:VEVENT
END:VCALENDAR`;

      const blocks = parseIcsToBlocks(icsData);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].title).toBe("London Meeting");
    });
  });

  describe("round-trip export and parse", () => {
    it("preserves block dates, times, titles and descriptions", () => {
      const exportedIcs = exportBlocksToIcs(sampleBlocks);
      const imported = parseIcsToBlocks(exportedIcs);

      expect(imported).toHaveLength(2);

      const b1 = imported.find((b) => b.title === sampleBlocks[0].title);
      expect(b1).toBeDefined();
      expect(b1?.date).toBe(sampleBlocks[0].date);
      expect(b1?.start).toBe(sampleBlocks[0].start);
      expect(b1?.end).toBe(sampleBlocks[0].end);
      expect(b1?.description).toBe(sampleBlocks[0].description);

      const b2 = imported.find((b) => b.title === sampleBlocks[1].title);
      expect(b2).toBeDefined();
      expect(b2?.date).toBe(sampleBlocks[1].date);
      expect(b2?.start).toBe(sampleBlocks[1].start);
      expect(b2?.end).toBe(sampleBlocks[1].end);
    });
  });
});
