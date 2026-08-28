import { describe, it, expect } from "vitest";
import { formatNoteAsMarkdownString, renderMarkdownToCleanHtml } from "./notes-export";
import type { Note } from "./data/domains/notes";

const sampleNote: Note = {
  id: "n-123",
  title: "Architecture Decisions",
  body: "## Context\nWe decided to use client-side rendering.",
  tag: "Engineering",
  author: "Amine",
  sourceUrl: "https://wasl.app",
  contentType: "read",
  pinned: true,
  updatedAt: 1700000000000,
};

describe("notes-export", () => {
  it("formats note with YAML frontmatter and body", () => {
    const md = formatNoteAsMarkdownString(sampleNote);
    expect(md).toContain("---");
    expect(md).toContain('title: "Architecture Decisions"');
    expect(md).toContain('tag: "Engineering"');
    expect(md).toContain('author: "Amine"');
    expect(md).toContain('sourceUrl: "https://wasl.app"');
    expect(md).toContain('contentType: "read"');
    expect(md).toContain("## Context\nWe decided to use client-side rendering.");
  });

  it("handles notes with minimal fields", () => {
    const minimalNote: Note = {
      id: "n-456",
      title: "Quick Thought",
      body: "Just an idea.",
      tag: "General",
      pinned: false,
      updatedAt: 1700000000000,
    };
    const md = formatNoteAsMarkdownString(minimalNote);
    expect(md).toContain('title: "Quick Thought"');
    expect(md).toContain("Just an idea.");
  });

  it("renders markdown to clean HTML for PDF document", () => {
    const rawMarkdown = `## Overview
- First item
- Second item with **bold text**

1. Step one
2. Step two

> Useful tip

\`\`\`js
console.log("hello");
\`\`\`
`;
    const html = renderMarkdownToCleanHtml(rawMarkdown);
    expect(html).toContain("<h2>Overview</h2>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>First item</li>");
    expect(html).toContain("<strong>bold text</strong>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>Step one</li>");
    expect(html).toContain("<blockquote>Useful tip</blockquote>");
    expect(html).toContain("<pre><code>console.log(&quot;hello&quot;);</code></pre>");
  });
});
