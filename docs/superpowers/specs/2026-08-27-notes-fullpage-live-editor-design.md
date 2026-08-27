# Notes Full-Page In-Place Live Preview Editor Specification

## Overview
Transform the note creation and editing experience in WASL from a constrained popup modal card into a full-page, distraction-free document editor (matching the Read view aesthetic in `NoteDetail`) featuring in-place hybrid live markdown rendering (e.g. typing `## title` formats live as a heading) and fixing base64 / URL image insertion and rendering.

---

## 1. Requirements & User Experience

### 1.1 Full-Page Document Canvas
- **Viewport Structure**: Replaces the `Modal` card with a full-page overlay (`fixed inset-0 z-50 overflow-y-auto bg-bg/95 backdrop-blur-xl animate-in fade-in duration-200`).
- **Sticky Top Bar**:
  - **Back Button**: Exits edit mode and returns to Notes list/grid or previous view.
  - **Category Selector**: Allows picking or creating custom categories with color indicators.
  - **Content Type Selector**: Segmented toggle for `Note`, `Read`, `Listen`, `Idea`.
  - **Word Count & Read Time**: Dynamically calculated (e.g., `120 words · 1 min read`).
  - **Auto-Save Status Indicator**: Clear real-time status (`Saved`, `Saving...`, `Save failed · Retry`).
  - **View Mode Switcher**:
    - `Live`: Default in-place live preview editor.
    - `Source`: Raw markdown text editor.
    - `Preview`: Pure read-only rendered view.
  - **Formatting Toolbar**: Quick actions for H1, H2, H3, Bold, Italic, Bullet list, Task list, Blockquote, Code block, and Image insertion.
  - **Delete & Done Actions**: Safe deletion with confirmation and `Done` to finalize/close.

### 1.2 In-Place Hybrid Live Markdown Rendering
- **Single Canvas Flow**: No split panes.
- **Dynamic In-Place Formatting**:
  - Headers (`# `, `## `, `### `) render as visual headings.
  - Interactive checklists (`- [ ]`, `- [x]`) allow direct checkbox clicking to toggle status.
  - Bulleted/numbered lists, blockquotes, code blocks, bold, and italic text render cleanly in the live flow.
  - Preserves standard raw markdown underlying data representation to ensure 100% compatibility with MCP tools, backups, migrations, and export.

### 1.3 Image Insertion & Rendering Fixes
- **Root Cause Resolution**: `react-markdown`'s default `urlTransform` drops `data:` URIs (such as `data:image/webp;base64,...`). We supply a safe `urlTransform` function to `MarkdownRenderer` allowing `data:image/` and standard web image URLs.
- **Image Insertion UX**:
  - Drag-and-drop, clipboard paste, and the `ImageInsertModal` file upload / URL dialog insert markdown image tags `![caption | align | size](src)`.
  - In Live mode, images render as full visual cards with alignment, size, caption, and zoom lightbox rather than raw unreadable base64 code strings.

---

## 2. Technical Architecture & Component Changes

### 2.1 `MarkdownRenderer` (`components/ui/MarkdownRenderer.tsx`)
- Add `safeUrlTransform` property to `ReactMarkdown` allowing `http:`, `https:`, `data:image/`, and relative URLs.
- Ensure all image tags render with fallback handling if an image source is invalid or loading.

### 2.2 `NoteForm` (`components/forms/NoteForm.tsx`)
- Refactor from using `<Modal>` to rendering as a full-page document overlay matching `NoteDetail`.
- Integrate an in-place live markdown editor component (`LiveMarkdownEditor`) as the default writing canvas.
- Provide mode switching (`Live`, `Source`, `Preview`).
- Maintain existing `CoalescingSaveQueue`, debounced auto-saving, navigation guards (`beforeunload`), and lifecycle cleanup.

### 2.3 `LiveMarkdownEditor` (`components/notes/LiveMarkdownEditor.tsx`)
- An interactive component that renders the document content in-place:
  - Editable title input with auto-growing height and large typography.
  - In-place block editor or live-styled interactive canvas for markdown blocks (headings, lists, tasks, quotes, code, images).
  - Handles key shortcuts (Enter to create new block, Backspace to merge/delete, Tab for indentation).
  - Handles image pastes and drops seamlessly.
  - Checkbox toggle updates the underlying markdown string in place.

### 2.4 Parity Across Workspaces
- Ensure all fixes and improvements are applied identically across both `/home/amine/wasl-cloud` and `/home/amine/wasl-local`.

---

## 3. Verification & Validation Plan
1. **Linting & Typechecking**: Run `npm run lint` and `npx tsc --noEmit` on both cloud and local workspaces.
2. **Automated Tests**: Run `npm test` across both workspaces to ensure zero regression in data models, migrations, or components.
3. **Manual Flow Verification**:
   - Create new note -> verify full page opens with clean title and body.
   - Type `## Test Heading` -> verify it renders in-place as a heading.
   - Insert an image (upload / paste / url) -> verify image renders immediately in-place and in preview/read modes.
   - Toggle checkboxes -> verify state toggles cleanly and saves.
   - Test auto-save and close -> verify data persists properly in IndexedDB / Supabase.
