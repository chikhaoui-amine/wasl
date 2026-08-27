# Design Spec: Notes Live WYSIWYG Document Canvas & Image Fixes

## 1. Objective & Requirements
1. **Note Card Image Removal**: Note cards on the main notes grid/list must strictly display title, tag, content type, and metadata without rendering photo thumbnails on the card.
2. **Image Alignment & Float Fix**: Floated images (`left`, `right`) in both read view and live editor must allow text to wrap smoothly around the image (responsive float, proper margins, and appropriate max-width). In `ImageInsertModal`, choosing left/right float defaults to `medium` or `small` size instead of 100% full width.
3. **Seamless Live WYSIWYG Document Canvas**: Replace the discrete block-by-block editor with a single continuous, borderless, rich document surface:
   - When choosing **Header 1** (or typing `# `), text immediately renders as a styled large heading on the canvas.
   - Rich formatting: Headings (`H1`, `H2`, `H3`), Bold, Italic, Underline, Strikethrough, Bulleted List, Numbered List, Task Checklist (`- [ ]`), Blockquote, Code block.
   - Interactive task checkboxes directly clickable on the canvas.
   - Images inserted appear inline with their configured alignment.
   - Under the hood, converts transparently to/from clean standard Markdown (GFM) ensuring 100% zero-migration compatibility with existing notes, sync, MCP tools, and backups.

---

## 2. Architecture & Components

### A. Note Card Update (`app/notes/page.tsx`)
- Remove `extractFirstImageUrl` and the `<img />` card header from `NoteCard`.
- NoteCard renders: Category pill, Content Type icon/pill, action buttons (edit, pin), Title with RTL auto-detection, Author (if present), Source Link, and timestamp.

### B. Image Alignment (`MarkdownRenderer.tsx` & `ImageInsertModal.tsx`)
- In `MarkdownRenderer.tsx`:
  - `align="left"`: `float-none sm:float-left sm:mr-6 sm:mb-4 sm:max-w-[48%] w-full sm:w-auto`
  - `align="right"`: `float-none sm:float-right sm:ml-6 sm:mb-4 sm:max-w-[48%] w-full sm:w-auto`
  - `align="center"`: `my-5 mx-auto block clear-both`
  - `align="full"`: `my-5 w-full block clear-both`
  - Remove unnecessary `clear-both` from standard headings and paragraphs so text floats beside images naturally.
- In `ImageInsertModal.tsx`:
  - Switching alignment to `left` or `right` automatically adjusts default size to `medium` (or respects custom user size).

### C. Live WYSIWYG Document Editor (`LiveMarkdownEditor.tsx`)
- **Single Continuous Surface**: A single `contentEditable` document container with clean typography (`prose-wasl`).
- **Real-time Typing Shortcuts**:
  - `# ` at start of line -> converts line to `<h1>`
  - `## ` at start of line -> converts line to `<h2>`
  - `### ` at start of line -> converts line to `<h3>`
  - `- ` or `* ` -> converts line to unordered list `<ul><li>`
  - `1. ` -> converts line to ordered list `<ol><li>`
  - `[ ] ` or `- [ ] ` -> converts line to interactive task list `<div data-type="task">`
  - `> ` -> converts line to `<blockquote>`
  - ```` -> converts line to `<pre><code>`
- **Toolbar Actions**:
  - Direct formatting via document execution / formatting helpers for selection or active block.
- **Task List Checkboxes**:
  - Custom task item elements with clickable checkbox buttons that update the DOM and emit updated markdown.
- **Markdown <-> HTML Sync Engine**:
  - `markdownToHtml(md)`: Converts note markdown into rich editable DOM structure.
  - `htmlToMarkdown(html)`: Serializes rich editable DOM structure into clean, standard Markdown.
  - Debounced `onChange` notifies `NoteForm` for auto-saving.

---

## 3. Edition Parity & Data Integrity
- Identical code across `wasl-cloud` and `wasl-local`.
- Zero database or store schema changes (persisted format remains pure Markdown).
- All unit tests pass in both editions.
