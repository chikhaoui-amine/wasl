# Full-Page In-Place Live Preview Note Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform note editing from a modal card into a full-page distraction-free document editor with in-place hybrid live markdown rendering (headings, interactive tasks, styles) and resolve image rendering/insertion issues.

**Architecture:** Refactor `NoteForm` to render a full-page overlay matching `NoteDetail`, create an interactive `LiveMarkdownEditor` component that renders markdown elements (headings, images, interactive checkboxes) in-place as you type, and configure `urlTransform` in `MarkdownRenderer` to prevent `react-markdown` from stripping base64 image data URLs.

**Tech Stack:** Next.js 16 / React 19, TypeScript, Tailwind CSS, Lucide Icons, `react-markdown`, `remark-gfm`, `remark-breaks`, Vitest.

---

## Global Constraints
- Preserve `DataAdapter` interface and strict Zod state schemas.
- Ensure 100% parity across `/home/amine/wasl-cloud` and `/home/amine/wasl-local`.
- Ensure zero regression in `CoalescingSaveQueue`, auto-save debounce, and offline safe sync.
- Preserved underlying data must remain pure Markdown string format in `note.body`.

---

### Task 1: Safe URL Transform for Markdown Images (`MarkdownRenderer.tsx`)

**Files:**
- Modify: `components/ui/MarkdownRenderer.tsx`
- Create/Modify: `components/ui/MarkdownRenderer.test.tsx`

**Interfaces:**
- Produces: `safeMarkdownUrlTransform(url: string): string`
- Modifies: `<ReactMarkdown urlTransform={safeMarkdownUrlTransform} ...>`

- [ ] **Step 1: Write test verifying data:image URL rendering**

```tsx
import { render, screen } from "@testing-library/react";
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
});
```

- [ ] **Step 2: Run test to verify it fails without urlTransform**

Run: `npx vitest run components/ui/MarkdownRenderer.test.tsx`
Expected: FAIL (img src is stripped / empty)

- [ ] **Step 3: Implement safeMarkdownUrlTransform in `MarkdownRenderer.tsx`**

```tsx
export function safeMarkdownUrlTransform(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }
  return "";
}
```
And apply `urlTransform={safeMarkdownUrlTransform}` in `<ReactMarkdown ... />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/ui/MarkdownRenderer.test.tsx`
Expected: PASS

---

### Task 2: In-Place Hybrid Live Markdown Editor Component (`LiveMarkdownEditor.tsx`)

**Files:**
- Create: `components/notes/LiveMarkdownEditor.tsx`
- Create: `components/notes/LiveMarkdownEditor.test.tsx`

**Interfaces:**
- Consumes: `body: string`, `onChange: (newBody: string) => void`, `textareaRef?: React.RefObject<HTMLTextAreaElement | null>`
- Produces: `<LiveMarkdownEditor />` supporting in-place heading formatting, interactive checklists, inline image cards with zoom/lightbox, formatting tools insertion, and pasting/dropping images.

- [ ] **Step 1: Write tests for LiveMarkdownEditor**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LiveMarkdownEditor } from "./LiveMarkdownEditor";

describe("LiveMarkdownEditor", () => {
  it("renders initial content with live heading and task checkbox", () => {
    const initialText = "## Section Header\n\n- [ ] Do laundry";
    const handleChange = vi.fn();
    render(<LiveMarkdownEditor content={initialText} onChange={handleChange} />);

    expect(screen.getByText("Section Header")).toBeDefined();
    expect(screen.getByText("Do laundry")).toBeDefined();
  });

  it("toggles task checklist item when clicked", () => {
    const initialText = "- [ ] Task 1\n- [ ] Task 2";
    const handleChange = vi.fn();
    render(<LiveMarkdownEditor content={initialText} onChange={handleChange} />);

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    expect(handleChange).toHaveBeenCalledWith("- [x] Task 1\n- [ ] Task 2");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run components/notes/LiveMarkdownEditor.test.tsx`
Expected: FAIL (component not found)

- [ ] **Step 3: Implement LiveMarkdownEditor component**

Implement `components/notes/LiveMarkdownEditor.tsx` with:
- Synchronized editable text area and in-place styled markdown renderer.
- Support for clicking interactive task checkboxes directly to toggle `- [ ]` <-> `- [x]`.
- Live rendering for `#`, `##`, `###`, blockquotes, code blocks, lists, and images.
- Drag and drop + paste handlers with `compressImage` and `formatImageMarkdown`.
- Keyboard navigation and shortcut handlers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/notes/LiveMarkdownEditor.test.tsx`
Expected: PASS

---

### Task 3: Full-Page NoteForm Transformation (`NoteForm.tsx`)

**Files:**
- Modify: `components/forms/NoteForm.tsx`
- Modify: `components/forms/NoteForm.test.tsx`

**Interfaces:**
- Props: `open: boolean`, `onClose: () => void`, `note?: Note`
- Renders: Full-page view (`fixed inset-0 z-50 overflow-y-auto bg-bg/95 backdrop-blur-xl`) with sticky top control bar and distraction-free document canvas.

- [ ] **Step 1: Update NoteForm tests for full-page structure and live preview**

Update `components/forms/NoteForm.test.tsx` to verify:
- Full-page container rendering when open.
- Title input updating and debounced auto-save.
- View mode switcher (`Live`, `Source`, `Preview`).
- Category selection and Content Type selection.
- Done button and Escape key closing behavior.

- [ ] **Step 2: Run tests to verify failure/update needs**

Run: `npx vitest run components/forms/NoteForm.test.tsx`

- [ ] **Step 3: Refactor NoteForm to full-page layout with LiveMarkdownEditor**

- Replace `<Modal>` container with full-page backdrop:
  `fixed inset-0 z-50 overflow-y-auto bg-bg/95 backdrop-blur-xl animate-in fade-in duration-200`
- Create sticky top control header with:
  - Back button (`<ArrowLeft />`)
  - Category selector pill with color indicator
  - Content type segmented selector (`Note`, `Read`, `Listen`, `Idea`)
  - Word count & read time indicator
  - Real-time save status badge (`✓ Saved`, `Saving...`, `Save failed · Retry`)
  - Mode switcher (`Live`, `Source`, `Preview`)
  - Formatting toolbar & Image inserter button
  - Delete button (with confirmation) & Done button
- Create document body:
  - Large auto-resizing Title input (`text-2xl sm:text-4xl font-extrabold`)
  - Metadata inputs (Author, Source URL) when type is `read` or `listen`
  - Body area: `LiveMarkdownEditor` (in Live mode), Monospace textarea (in Source mode), `MarkdownRenderer` (in Preview mode).

- [ ] **Step 4: Run NoteForm tests to verify passing**

Run: `npx vitest run components/forms/NoteForm.test.tsx`
Expected: PASS

---

### Task 4: Parity & Verification Across Workspaces (`wasl-cloud` & `wasl-local`)

**Files:**
- Sync: `/home/amine/wasl-cloud/` <-> `/home/amine/wasl-local/` for all modified components and tests.

- [ ] **Step 1: Copy modified components and tests to `wasl-local`**
- [ ] **Step 2: Run full test suite in `wasl-cloud` and `wasl-local`**
  - Run: `npm test` in `wasl-cloud`
  - Run: `npm test` in `wasl-local`
- [ ] **Step 3: Run typechecks and linters**
  - Run: `npx tsc --noEmit` and `npm run lint` in `wasl-cloud`
  - Run: `npx tsc --noEmit` and `npm run lint` in `wasl-local`
- [ ] **Step 4: Run production builds**
  - Run: `npm run build:cloud` and `npm run build:local` in `wasl-cloud`
  - Run: `npm run build` in `wasl-local`
