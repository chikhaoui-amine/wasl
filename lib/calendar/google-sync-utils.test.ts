import { describe, it, expect } from "vitest";
import {
  googleEventToBlock,
  blockToGoogleEvent,
  mergeGoogleEvents,
  decimalHoursToIso,
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
          title: "Fresh Local Edit",
          date: "2026-10-08",
          start: 9,
          end: 10,
          color: "#7c9cf5",
          updatedAt: "2026-10-08T12:00:00.000Z", // newer
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
});
