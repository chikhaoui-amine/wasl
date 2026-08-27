// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { LiveMarkdownEditor, markdownToHtml, htmlToMarkdown } from "./LiveMarkdownEditor";

describe("LiveMarkdownEditor", () => {
  afterEach(cleanup);

  it("converts markdown to clean HTML and renders headings and tasks", () => {
    const markdown = "# Title 1\n\n## Section Header\n\n- [ ] Task 1\n- [x] Task 2\n\n> Quote text\n\n- List 1\n- List 2";
    const html = markdownToHtml(markdown);
    expect(html).toContain("<h1");
    expect(html).toContain("Title 1");
    expect(html).toContain("<h2");
    expect(html).toContain("Section Header");
    expect(html).toContain('data-type="task"');
    expect(html).toContain("Task 1");
    expect(html).toContain("<blockquote");
    expect(html).toContain("<ul");
  });

  it("renders live WYSIWYG editor and handles checkbox toggle", () => {
    const initialText = "- [ ] Task 1\n- [ ] Task 2";
    const handleChange = vi.fn();
    render(<LiveMarkdownEditor value={initialText} onChange={handleChange} />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(2);

    fireEvent.click(checkboxes[0]);
    expect(handleChange).toHaveBeenCalled();
  });

  it("serializes HTML back to markdown cleanly", () => {
    const div = document.createElement("div");
    div.innerHTML = "<h1>Title</h1><p>Paragraph <strong>bold</strong> <em>italic</em></p><blockquote>Quote</blockquote>";
    const md = htmlToMarkdown(div);
    expect(md).toContain("# Title");
    expect(md).toContain("Paragraph **bold** *italic*");
    expect(md).toContain("> Quote");
  });

  it("renders image figure elements with float and caption data attributes", () => {
    const md = "![My Photo | left | medium](https://example.com/photo.png)";
    const html = markdownToHtml(md);
    expect(html).toContain('data-type="image"');
    expect(html).toContain("https://example.com/photo.png");
    expect(html).toContain("sm:float-left");
    expect(html).toContain("My Photo");
  });
});
