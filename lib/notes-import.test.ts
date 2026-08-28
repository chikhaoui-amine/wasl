import { describe, it, expect } from "vitest";
import { parseMarkdownNote } from "./notes-import";

describe("notes-import", () => {
  it("parses YAML frontmatter correctly", () => {
    const raw = `---
title: "Parsed Title"
tag: "Productivity"
author: "Ada Lovelace"
contentType: "idea"
---

This is the note body.`;

    const parsed = parseMarkdownNote(raw, "doc.md", "General");
    expect(parsed.title).toBe("Parsed Title");
    expect(parsed.tag).toBe("Productivity");
    expect(parsed.author).toBe("Ada Lovelace");
    expect(parsed.contentType).toBe("idea");
    expect(parsed.body).toBe("This is the note body.");
  });

  it("extracts title from first heading when frontmatter is missing", () => {
    const raw = `# My Morning Routine\n\n1. Drink water\n2. Stretch`;
    const parsed = parseMarkdownNote(raw, "routine.md", "Personal");
    expect(parsed.title).toBe("My Morning Routine");
    expect(parsed.tag).toBe("Personal");
    expect(parsed.body).toBe("1. Drink water\n2. Stretch");
  });

  it("derives title from filename when no heading is present", () => {
    const raw = `Plain text content without title heading.`;
    const parsed = parseMarkdownNote(raw, "Quick-Thoughts-2026.md", "Ideas");
    expect(parsed.title).toBe("Quick Thoughts 2026");
    expect(parsed.tag).toBe("Ideas");
    expect(parsed.body).toBe("Plain text content without title heading.");
  });
});
