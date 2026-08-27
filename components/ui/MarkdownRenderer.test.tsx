// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MarkdownRenderer, safeMarkdownUrlTransform } from "./MarkdownRenderer";

describe("MarkdownRenderer safeUrlTransform", () => {
  it("allows data:image/ URIs to pass through safely", () => {
    const dataUri = "data:image/webp;base64,UklGRnoTAABXRUJQVlA4";
    expect(safeMarkdownUrlTransform(dataUri)).toBe(dataUri);
  });

  it("allows standard http and https URLs", () => {
    expect(safeMarkdownUrlTransform("https://example.com/img.png")).toBe("https://example.com/img.png");
    expect(safeMarkdownUrlTransform("http://example.com/img.png")).toBe("http://example.com/img.png");
  });

  it("disallows dangerous javascript: URIs", () => {
    expect(safeMarkdownUrlTransform("javascript:alert(1)")).toBe("");
  });

  it("renders an img element with a data:image source", () => {
    const markdown = "![Test Image](data:image/webp;base64,UklGRnoTAABXRUJQVlA4)";
    const { container } = render(<MarkdownRenderer content={markdown} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("data:image/webp;base64,UklGRnoTAABXRUJQVlA4");
  });

  it("renders left float image container with proper responsive classes", () => {
    const markdown = "![Left Photo | left | medium](https://example.com/photo.png)";
    const { container } = render(<MarkdownRenderer content={markdown} />);
    const figure = container.querySelector("figure");
    expect(figure?.className).toContain("sm:float-left");
    expect(figure?.className).toContain("sm:mr-6");
  });

  it("renders right float image container with proper responsive classes", () => {
    const markdown = "![Right Photo | right | small](https://example.com/photo.png)";
    const { container } = render(<MarkdownRenderer content={markdown} />);
    const figure = container.querySelector("figure");
    expect(figure?.className).toContain("sm:float-right");
    expect(figure?.className).toContain("sm:ml-6");
  });

  it("renders reference-style markdown images seamlessly", () => {
    const markdown = "# Title\n\n![Ref Photo | left | medium][img-1]\n\n[img-1]: https://example.com/pic.png";
    const { container } = render(<MarkdownRenderer content={markdown} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/pic.png");
    const figure = container.querySelector("figure");
    expect(figure?.className).toContain("sm:float-left");
  });

  it("renders captionless reference image with left float and no text figcaption", () => {
    const markdown = "Paragraph\n\n![left | medium][img-1]\n\n[img-1]: https://example.com/pic.png";
    const { container } = render(<MarkdownRenderer content={markdown} />);
    const figure = container.querySelector("figure");
    expect(figure?.className).toContain("sm:float-left");
    const figcaption = container.querySelector("figcaption");
    expect(figcaption).toBeNull();
  });
});
