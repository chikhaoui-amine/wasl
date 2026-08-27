import { describe, it, expect } from "vitest";
import { applyEditorFormatting } from "./editor-formatting";

describe("applyEditorFormatting", () => {
  it("inserts header prefix when there is no text selection", () => {
    const textarea = {
      selectionStart: 0,
      selectionEnd: 0,
    } as HTMLTextAreaElement;

    const result = applyEditorFormatting(textarea, "", "# ");
    expect(result.newText).toBe("# ");
    expect(result.selectionStart).toBe(2);
    expect(result.selectionEnd).toBe(2);
  });

  it("prefixes at selection position", () => {
    const textarea = {
      selectionStart: 6,
      selectionEnd: 11,
    } as HTMLTextAreaElement;

    const result = applyEditorFormatting(textarea, "Hello World", "## ");
    expect(result.newText).toBe("Hello ## World");
    expect(result.selectionStart).toBe(14);
    expect(result.selectionEnd).toBe(14);
  });

  it("wraps selected text with bold formatting", () => {
    const textarea = {
      selectionStart: 0,
      selectionEnd: 5,
    } as HTMLTextAreaElement;

    const result = applyEditorFormatting(textarea, "Hello World", "**", "**");
    expect(result.newText).toBe("**Hello** World");
    expect(result.selectionStart).toBe(9);
    expect(result.selectionEnd).toBe(9);
  });

  it("handles null textarea fallback gracefully", () => {
    const result = applyEditorFormatting(null, "Notes", "### ");
    expect(result.newText).toBe("Notes### ");
    expect(result.selectionStart).toBe(9);
    expect(result.selectionEnd).toBe(9);
  });
});
