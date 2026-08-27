import { describe, it, expect } from "vitest";
import { parseImageMarkdown, formatImageMarkdown, extractFirstImageUrl } from "./images";

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
});
