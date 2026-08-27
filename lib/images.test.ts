import { describe, it, expect } from "vitest";
import {
  parseImageMarkdown,
  formatImageMarkdown,
  formatImageReference,
  extractFirstImageUrl,
  parseNoteMarkdown,
  composeNoteMarkdown,
} from "./images";

describe("lib/images", () => {
  it("parses image markdown with alignment and size", () => {
    const res = parseImageMarkdown("Architecture diagram | left | medium");
    expect(res.caption).toBe("Architecture diagram");
    expect(res.align).toBe("left");
    expect(res.size).toBe("medium");
  });

  it("parses right float and small size", () => {
    const res = parseImageMarkdown("Chart | right | small");
    expect(res.caption).toBe("Chart");
    expect(res.align).toBe("right");
    expect(res.size).toBe("small");
  });

  it("parses image markdown without caption when only alignment and size are present", () => {
    const res = parseImageMarkdown("left | medium");
    expect(res.caption).toBe("");
    expect(res.align).toBe("left");
    expect(res.size).toBe("medium");
  });

  it("parses single alignment keyword without pipes", () => {
    const resLeft = parseImageMarkdown("left");
    expect(resLeft.caption).toBe("");
    expect(resLeft.align).toBe("left");

    const resRight = parseImageMarkdown("right");
    expect(resRight.caption).toBe("");
    expect(resRight.align).toBe("right");
  });

  it("handles default fallback for plain alt text", () => {
    const res = parseImageMarkdown("Just a simple photo");
    expect(res.caption).toBe("Just a simple photo");
    expect(res.align).toBe("center");
    expect(res.size).toBe("full");
  });

  it("handles empty or whitespace alt text", () => {
    const res = parseImageMarkdown("");
    expect(res.caption).toBe("");
    expect(res.align).toBe("center");
    expect(res.size).toBe("full");
  });

  it("formats image markdown correctly with options", () => {
    const md = formatImageMarkdown("https://example.com/pic.jpg", {
      caption: "Graph",
      align: "right",
      size: "small",
    });
    expect(md).toBe("![Graph | right | small](https://example.com/pic.jpg)");
  });

  it("formats image markdown with defaults", () => {
    const md = formatImageMarkdown("https://example.com/pic.jpg");
    expect(md).toBe("![center | full](https://example.com/pic.jpg)");
  });

  it("extracts first image url from markdown content", () => {
    const content = "# Title\nSome text\n![Diagram](data:image/webp;base64,abc123)\nMore text";
    const url = extractFirstImageUrl(content);
    expect(url).toBe("data:image/webp;base64,abc123");
  });

  it("extracts first image url with complex alt text", () => {
    const content = "Paragraph\n\n![Screenshot | left | medium](https://example.com/shot.png)\n\n![Second](https://example.com/two.png)";
    const url = extractFirstImageUrl(content);
    expect(url).toBe("https://example.com/shot.png");
  });

  it("returns null when markdown has no images", () => {
    expect(extractFirstImageUrl("No images here")).toBeNull();
  });

  it("extracts first image url from reference-style markdown", () => {
    const md = "Some text\n![My Photo][img-1]\n\n[img-1]: https://example.com/photo.png";
    expect(extractFirstImageUrl(md)).toBe("https://example.com/photo.png");
  });

  it("formats image reference correctly", () => {
    const ref = formatImageReference("img-1", {
      caption: "Architecture",
      align: "left",
      size: "medium",
    });
    expect(ref).toBe("![Architecture | left | medium][img-1]");
  });

  it("parses reference definitions and extracts clean body", () => {
    const raw = "# Title\n\n![Diagram | left | medium][img-1]\n\nSome text.\n\n[img-1]: data:image/webp;base64,abc123";
    const parsed = parseNoteMarkdown(raw);
    expect(parsed.cleanBody).toBe("# Title\n\n![Diagram | left | medium][img-1]\n\nSome text.");
    expect(parsed.references["img-1"]).toBe("data:image/webp;base64,abc123");
    expect(parsed.nextId).toBe(2);
  });

  it("normalizes legacy inline base64 images into reference tags", () => {
    const raw = "# Title\n\n![My Photo | center | full](data:image/webp;base64,xyz987)\n\nEnd text.";
    const parsed = parseNoteMarkdown(raw);
    expect(parsed.cleanBody).toBe("# Title\n\n![My Photo | center | full][img-1]\n\nEnd text.");
    expect(parsed.references["img-1"]).toBe("data:image/webp;base64,xyz987");
    expect(parsed.nextId).toBe(2);
  });

  it("composes clean body and reference definitions back to markdown", () => {
    const cleanBody = "# Title\n\n![My Photo][img-1]";
    const references = { "img-1": "data:image/webp;base64,xyz987" };
    const composed = composeNoteMarkdown(cleanBody, references);
    expect(composed).toBe("# Title\n\n![My Photo][img-1]\n\n[img-1]: data:image/webp;base64,xyz987\n");
  });

  it("handles compose with empty references", () => {
    expect(composeNoteMarkdown("Clean markdown text", {})).toBe("Clean markdown text");
  });
});
