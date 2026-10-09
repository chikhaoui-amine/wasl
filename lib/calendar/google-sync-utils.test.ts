import { describe, it, expect } from "vitest";
import {
  googleEventToBlock,
  blockToGoogleEvent,
  mergeGoogleEvents,
  decimalHoursToIso,
  hasUnpushedGoogleChanges,
  selectBlocksToPush,
  applyGooglePushResults,
  isoToDecimalHours,
  type GoogleCalendarEvent,
} from "./google-sync-utils";
import type { Block } from "@/lib/data/domains/blocks";

describe("Google Calendar Sync Utilities", () => {
  describe("time and decimal hours conversion", () => {
    it("converts decimal hours to ISO string and back", () => {
      const iso = decimalHoursToIso("2026-10-08", 14.75, "UTC");
      expect(iso).toContain("2026-10-08T14:45:00");

      const parsed = isoToDecimalHours("2026-10-08T14:45:00Z");
      expect(parsed.date).toBe("2026-10-08");
      expect(parsed.hour).toBe(14.75);
    });

    it("handles round hours cleanly", () => {
      const iso = decimalHoursToIso("2026-10-08", 9.0, "UTC");
      expect(iso).toContain("2026-10-08T09:00:00");

      const parsed = isoToDecimalHours("2026-10-08T09:00:00Z");
      expect(parsed.date).toBe("2026-10-08");
      expect(parsed.hour).toBe(9.0);
    });
  });

  describe("googleEventToBlock", () => {
    it("transforms timed Google event into a Block", () => {
      const event: GoogleCalendarEvent = {
        id: "gcal_abc123",
        status: "confirmed",
        summary: "Architecture Review",
        description: "Zoom link: https://zoom.us/j/123",
        updated: "2026-10-08T12:00:00.000Z",
        start: { dateTime: "2026-10-08T10:00:00Z" },
        end: { dateTime: "2026-10-08T11:30:00Z" },
      };

      const block = googleEventToBlock(event);
      expect(block.externalId).toBe("gcal_abc123");
      expect(block.externalProvider).toBe("google");
      expect(block.title).toBe("Architecture Review");
      expect(block.description).toBe("Zoom link: https://zoom.us/j/123");
      expect(block.date).toBe("2026-10-08");
      expect(block.start).toBe(10.0);
      expect(block.end).toBe(11.5);
      expect(block.updatedAt).toBe("2026-10-08T12:00:00.000Z");
    });

    it("handles all-day Google events gracefully", () => {
      const event: GoogleCalendarEvent = {
        id: "gcal_allday1",
        status: "confirmed",
        summary: "ESI Hackathon Day 1",
        start: { date: "2026-10-09" },
        end: { date: "2026-10-10" },
        updated: "2026-10-08T10:00:00.000Z",
      };

      const block = googleEventToBlock(event);
      expect(block.date).toBe("2026-10-09");
      expect(block.start).toBe(9.0);
      expect(block.end).toBe(10.0);
      expect(block.title).toContain("ESI Hackathon Day 1");
    });

    it("preserves existing block ID when provided", () => {
      const existing: Block = {
        id: "local_b_999",
        title: "Existing Title",
        date: "2026-10-08",
        start: 10,
        end: 11,
        color: "#123456",
        externalId: "gcal_abc123",
      };

      const event: GoogleCalendarEvent = {
        id: "gcal_abc123",
        summary: "Updated From Google",
        start: { dateTime: "2026-10-08T10:00:00Z" },
        end: { dateTime: "2026-10-08T11:00:00Z" },
        updated: "2026-10-08T13:00:00.000Z",
      };

      const merged = googleEventToBlock(event, existing);
      expect(merged.id).toBe("local_b_999");
      expect(merged.title).toBe("Updated From Google");
      expect(merged.color).toBe("#123456"); // preserves custom color
    });
  });

  describe("blockToGoogleEvent", () => {
    it("converts WASL block to Google Calendar payload", () => {
      const block: Block = {
        id: "b_123",
        date: "2026-10-08",
        start: 14.5,
        end: 16.0,
        title: "Deep Work: Sync Engine",
        color: "#7c9cf5",
        description: "Focus blocks",
        externalId: "gcal_existing",
      };

      const gcal = blockToGoogleEvent(block, "UTC");
      expect(gcal.summary).toBe("Deep Work: Sync Engine");
      expect(gcal.description).toBe("Focus blocks");
      expect(gcal.start?.dateTime).toContain("2026-10-08T14:30:00");
      expect(gcal.end?.dateTime).toContain("2026-10-08T16:00:00");
    });
  });

  describe("mergeGoogleEvents (Last-Write-Wins)", () => {
    it("inserts new Google event not present locally", () => {
      const current: Block[] = [];
      const incoming: GoogleCalendarEvent[] = [
        {
          id: "g1",
          status: "confirmed",
          summary: "New Meeting",
          updated: "2026-10-08T10:00:00.000Z",
          start: { dateTime: "2026-10-08T09:00:00Z" },
          end: { dateTime: "2026-10-08T10:00:00Z" },
        },
      ];

      const result = mergeGoogleEvents(current, incoming);
      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe("g1");
      expect(result[0].title).toBe("New Meeting");
    });

    it("updates local block when Google event is newer", () => {
      const current: Block[] = [
        {
          id: "b_local_1",
          externalId: "g1",
          externalProvider: "google",
          title: "Old Local Title",
          date: "2026-10-08",
          start: 9,
          end: 10,
          color: "#7c9cf5",
          updatedAt: "2026-10-08T09:00:00.000Z",
        },
      ];

      const incoming: GoogleCalendarEvent[] = [
        {
          id: "g1",
          status: "confirmed",
          summary: "New Remote Title",
          updated: "2026-10-08T11:00:00.000Z", // newer
          start: { dateTime: "2026-10-08T09:00:00Z" },
          end: { dateTime: "2026-10-08T10:00:00Z" },
        },
      ];

      const result = mergeGoogleEvents(current, incoming);
      expect(result[0].title).toBe("New Remote Title");
      expect(result[0].updatedAt).toBe("2026-10-08T11:00:00.000Z");
    });

    it("preserves local block when local edit is newer than Google event", () => {
      const current: Block[] = [
        {
          id: "b_local_1",
          externalId: "g1",
          externalProvider: "google",
          title: "Fresh Local Edit",
          date: "2026-10-08",
          start: 9,
          end: 10,
          color: "#7c9cf5",
          updatedAt: "2026-10-08T12:00:00.000Z", // newer, not yet pushed
          externalUpdatedAt: "2026-10-08T09:00:00.000Z",
        },
      ];

      const incoming: GoogleCalendarEvent[] = [
        {
          id: "g1",
          status: "confirmed",
          summary: "Stale Remote Title",
          updated: "2026-10-08T10:00:00.000Z", // older
          start: { dateTime: "2026-10-08T09:00:00Z" },
          end: { dateTime: "2026-10-08T10:00:00Z" },
        },
      ];

      const result = mergeGoogleEvents(current, incoming);
      expect(result[0].title).toBe("Fresh Local Edit");
    });

    it("deletes local block when Google event status is cancelled", () => {
      const current: Block[] = [
        {
          id: "b_local_1",
          externalId: "g1",
          externalProvider: "google",
          title: "To Be Deleted",
          date: "2026-10-08",
          start: 9,
          end: 10,
          color: "#7c9cf5",
          updatedAt: "2026-10-08T09:00:00.000Z",
        },
        {
          id: "b_local_2",
          title: "Keep Me",
          date: "2026-10-08",
          start: 11,
          end: 12,
          color: "#37c9b7",
        },
      ];

      const incoming: GoogleCalendarEvent[] = [
        {
          id: "g1",
          status: "cancelled",
        },
      ];

      const result = mergeGoogleEvents(current, incoming);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("b_local_2");
    });
  });

  describe("sync correctness", () => {
    const base: Block = {
      id: "b1",
      date: "2026-10-08",
      start: 9,
      end: 10,
      title: "Synced",
      color: "#7c9cf5",
      externalId: "g1",
      externalProvider: "google",
      updatedAt: "2026-10-08T09:00:00.000Z",
      externalUpdatedAt: "2026-10-08T09:00:00.000Z",
    };

    it("rolls hour 24 over to next day and never emits :60 minutes", () => {
      expect(decimalHoursToIso("2026-10-31", 24, "Europe/Paris")).toBe("2026-11-01T00:00:00");
      expect(decimalHoursToIso("2026-10-08", 9.999, "UTC")).toBe("2026-10-08T10:00:00.000Z");
    });

    it("clamps events crossing midnight to end of day", () => {
      const block = googleEventToBlock({
        id: "late",
        start: { dateTime: "2026-10-08T22:00:00+01:00" },
        end: { dateTime: "2026-10-09T01:00:00+01:00" },
      });
      expect(block.start).toBe(22);
      expect(block.end).toBe(24);
    });

    it("strips the all-day prefix when pushing", () => {
      expect(blockToGoogleEvent({ ...base, title: "[All-Day] Holiday" }).summary).toBe("Holiday");
    });

    it("pulled blocks are clean and not re-pushed", () => {
      const pulled = googleEventToBlock({ id: "g9", updated: "2026-10-08T10:00:00.000Z", start: { dateTime: "2026-10-08T10:00:00Z" } });
      expect(hasUnpushedGoogleChanges(pulled)).toBe(false);
      expect(selectBlocksToPush([pulled], "2026-10-08")).toHaveLength(0);
    });

    it("selects edited linked blocks and recent unlinked blocks only", () => {
      const edited = { ...base, id: "e", updatedAt: "2026-10-08T12:00:00.000Z" };
      const fresh = { ...base, id: "n", externalId: undefined, externalUpdatedAt: undefined };
      const ancient = { ...fresh, id: "old", date: "2020-01-01" };
      const ids = selectBlocksToPush([base, edited, fresh, ancient], "2026-10-08").map((b) => b.id);
      expect(ids).toEqual(["e", "n"]);
    });

    it("ignores events that were deleted locally but not yet pushed", () => {
      const result = mergeGoogleEvents([], [{ id: "g1", updated: "2026-10-08T10:00:00.000Z", start: { dateTime: "2026-10-08T10:00:00Z" } }], ["g1"]);
      expect(result).toHaveLength(0);
    });

    it("push results keep blocks edited during the push dirty", () => {
      const current = [
        { ...base, id: "a", externalId: undefined, externalUpdatedAt: undefined, updatedAt: "T1" },
        { ...base, id: "b", externalId: undefined, externalUpdatedAt: undefined, updatedAt: "T3" },
      ];
      const result = applyGooglePushResults(current, [
        { id: "a", externalId: "ga", updatedAt: "R1", sentUpdatedAt: "T1" },
        { id: "b", externalId: "gb", updatedAt: "R2", sentUpdatedAt: "T2" },
      ]);
      expect(result[0]).toMatchObject({ externalId: "ga", updatedAt: "R1", externalUpdatedAt: "R1" });
      expect(hasUnpushedGoogleChanges(result[0])).toBe(false);
      expect(result[1]).toMatchObject({ externalId: "gb", updatedAt: "T3", externalUpdatedAt: "R2" });
      expect(hasUnpushedGoogleChanges(result[1])).toBe(true);
    });
  });

  describe("multiple calendars and .ics imports", () => {
    const icsBlock: Block = {
      id: "ics-1",
      date: "2026-10-05",
      start: 8.5,
      end: 10.42,
      title: "Cours PRDS",
      color: "#37c9b7",
      externalId: "abc123@google.com",
      updatedAt: "2026-10-09T16:36:56.000Z",
    };

    it("links an .ics-imported block to the matching Google event instead of duplicating it", () => {
      const result = mergeGoogleEvents([icsBlock], [
        {
          id: "evt1",
          iCalUID: "abc123@google.com",
          summary: "Cours PRDS BENCHERIF A",
          updated: "2026-10-09T20:00:00.000Z",
          start: { dateTime: "2026-10-05T08:30:00+01:00" },
          end: { dateTime: "2026-10-05T10:25:00+01:00" },
          calendarId: "class@group.calendar.google.com",
        },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "ics-1",
        color: "#37c9b7",
        externalId: "evt1",
        externalProvider: "google",
        externalCalendarId: "class@group.calendar.google.com",
      });
    });

    it("tags events from other calendars with their calendar and color", () => {
      const [b] = mergeGoogleEvents([], [
        { id: "e2", calendarId: "class@group", calendarColor: "#ff0000", start: { dateTime: "2026-10-05T13:00:00+01:00" } },
      ]);
      expect(b.externalCalendarId).toBe("class@group");
      expect(b.color).toBe("#ff0000");
    });

    it("never pushes mirrors of other calendars or .ics imports, even when edited", () => {
      const mirror: Block = {
        ...icsBlock,
        id: "m",
        externalId: "e3",
        externalProvider: "google",
        externalCalendarId: "class@group",
        updatedAt: "2026-10-09T23:00:00.000Z",
        externalUpdatedAt: "2026-10-09T20:00:00.000Z",
      };
      const created: Block = { ...icsBlock, id: "new", externalId: undefined };
      const ids = selectBlocksToPush([icsBlock, mirror, created], "2026-10-09").map((b) => b.id);
      expect(ids).toEqual(["new"]);
    });
  });
});
