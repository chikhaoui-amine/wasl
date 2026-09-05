import { describe, it, expect } from "vitest";
import { migrateNotesSnapshot, CURRENT_NOTES_VERSION } from "./migrations";
import { NotesStateSchema } from "../../validation/domain-schemas";

describe("migrateNotesSnapshot with sections", () => {
  it("preserves category sections and note section on current version", () => {
    const raw = {
      notes: [
        { id: "n1", title: "Idea 1", body: "text", tag: "Ideas", section: "Approved" },
      ],
      categories: [
        { id: "c1", name: "Ideas", color: "#37c9b7", sections: ["Approved", "Rejected"] },
      ],
    };
    const migrated = migrateNotesSnapshot(raw, CURRENT_NOTES_VERSION);
    expect(migrated.categories[0].sections).toEqual(["Approved", "Rejected"]);
    expect(migrated.notes[0].section).toBe("Approved");
  });

  it("validates migrated state against NotesStateSchema", () => {
    const raw = {
      notes: [
        { id: "n1", title: "Idea 1", body: "text", tag: "Ideas", section: "Approved" },
      ],
      categories: [
        { id: "c1", name: "Ideas", color: "#37c9b7", sections: ["Approved", "Rejected"] },
      ],
    };
    const migrated = migrateNotesSnapshot(raw, CURRENT_NOTES_VERSION);
    const parsed = NotesStateSchema.safeParse(migrated);
    expect(parsed.success).toBe(true);
  });
});
