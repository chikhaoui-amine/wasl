import { describe, it, expect } from "vitest";
import { formatNoteToMarkdown, createZipArchive, sanitizeFileName } from "./notes-export";
import { parseMarkdownNote } from "./notes-import";
import type { Note } from "./data/domains/notes";

describe("Notes Export Utility", () => {
  it("sanitizes file names for cross-platform file systems", () => {
    expect(sanitizeFileName("Hello / World : Test?")).toBe("Hello - World - Test");
    expect(sanitizeFileName("")).toBe("untitled-note");
  });

  it("formats note to markdown frontmatter symmetrically with import parser", () => {
    const note: Note = {
      id: "test-id",
      title: "My Grand Strategy",
      body: "Execute step by step.",
      tag: "Strategy",
      author: "Amine",
      sourceUrl: "https://example.com/strategy",
      contentType: "idea",
      pinned: true,
      updatedAt: 1725888000000,
    };

    const md = formatNoteToMarkdown(note);
    expect(md).toContain('title: "My Grand Strategy"');
    expect(md).toContain('tag: "Strategy"');
    expect(md).toContain('author: "Amine"');
    expect(md).toContain('sourceUrl: "https://example.com/strategy"');
    expect(md).toContain('contentType: "idea"');
    expect(md).toContain("pinned: true");
    expect(md).toContain("Execute step by step.");

    // Symmetrical verification with parseMarkdownNote
    const parsed = parseMarkdownNote(md, "test.md");
    expect(parsed.title).toBe(note.title);
    expect(parsed.tag).toBe(note.tag);
    expect(parsed.author).toBe(note.author);
    expect(parsed.sourceUrl).toBe(note.sourceUrl);
    expect(parsed.contentType).toBe(note.contentType);
    expect(parsed.pinned).toBe(note.pinned);
    expect(parsed.body).toBe(note.body);
  });

  it("creates a valid zip archive buffer with valid PK headers for multiple files", async () => {
    const files = [
      { name: "note-1.md", content: "# Note 1\nHello" },
      { name: "note-2.md", content: "# Note 2\nWorld" },
    ];
    const zipBlob = createZipArchive(files);
    expect(zipBlob).toBeInstanceOf(Blob);
    expect(zipBlob.size).toBeGreaterThan(100);

    const buffer = await zipBlob.arrayBuffer();
    const view = new Uint8Array(buffer);
    // Local header signature: PK\x03\x04
    expect(view[0]).toBe(0x50);
    expect(view[1]).toBe(0x4b);
    expect(view[2]).toBe(0x03);
    expect(view[3]).toBe(0x04);
  });
});
