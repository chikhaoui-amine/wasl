# Notes Live WYSIWYG Document Canvas & Image Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a seamless, single-surface live WYSIWYG document canvas for note editing with markdown sync, remove photo thumbnails from main note cards, and fix left/right image floating across all views.

**Architecture:** 
- In `app/notes/page.tsx`, clean up `NoteCard` to exclude image thumbnails.
- In `components/ui/MarkdownRenderer.tsx` and `components/forms/ImageInsertModal.tsx`, refine image float classes (`left` and `right` floats with `sm:max-w-[48%]`, text wrapping without unintended clearing).
- In `components/notes/LiveMarkdownEditor.tsx`, build a unified `contentEditable` live document canvas that styles headings, bold, lists, quotes, and task checkboxes live as you type or click toolbar buttons, synchronizing bidirectionally to clean Markdown.
- In `components/forms/NoteForm.tsx`, connect the live editor to the sticky formatting toolbar and debounced auto-save queue.

**Tech Stack:** Next.js, React 19, TypeScript, Tailwind CSS, Lucide icons, Vitest.

## Global Constraints
- Persisted note format must remain 100% standard Markdown (GFM) — zero store schema changes or migrations needed.
- Strict edition parity: identical implementations and passing tests in `/home/amine/wasl-cloud` and `/home/amine/wasl-local`.
- Zero ESLint errors and TypeScript errors.

---

### Task 1: Remove Photo Previews from Note Cards

**Files:**
- Modify: `app/notes/page.tsx`
- Sync: `/home/amine/wasl-local/app/notes/page.tsx`

**Interfaces:**
- `NoteCard`: renders note tag, content type pill, action buttons, title, author, source link, timestamp (no image).

- [ ] **Step 1: Update `NoteCard` in `app/notes/page.tsx`**
Remove `firstImage` extraction and the card image container.

- [ ] **Step 2: Sync to `wasl-local/app/notes/page.tsx`**

- [ ] **Step 3: Run note tests**
Run `npx vitest run app/notes` or `npm test` to verify note cards render cleanly without images.

---

### Task 2: Fix Image Float Positioning & Alignment

**Files:**
- Modify: `components/ui/MarkdownRenderer.tsx`
- Modify: `components/forms/ImageInsertModal.tsx`
- Test: `components/ui/MarkdownRenderer.test.tsx`
- Sync: `/home/amine/wasl-local/components/ui/MarkdownRenderer.tsx`, `components/forms/ImageInsertModal.tsx`, `components/ui/MarkdownRenderer.test.tsx`

**Interfaces:**
- `getImageContainerClasses`: returns responsive float styling for `left` / `right` / `center` / `full`.
- `ImageInsertModal`: defaults size to `medium` when `left` or `right` alignment is selected.

- [ ] **Step 1: Update `MarkdownRenderer.test.tsx` with float tests**
Add assertions for left and right floated container classes.

- [ ] **Step 2: Update `MarkdownRenderer.tsx` image container classes**
Refine `getImageContainerClasses` so `left` has `float-none sm:float-left sm:mr-6 sm:mb-4 sm:max-w-[48%]` and `right` has `float-none sm:float-right sm:ml-6 sm:mb-4 sm:max-w-[48%]`, removing unnecessary `clear-both` on paragraphs/headings.

- [ ] **Step 3: Update `ImageInsertModal.tsx`**
When user switches alignment to `left` or `right`, auto-adjust size to `medium` if currently `full`.

- [ ] **Step 4: Run unit tests**
Run `npx vitest run components/ui/MarkdownRenderer.test.tsx`.

---

### Task 3: Build Single Continuous Live WYSIWYG Document Editor

**Files:**
- Create/Modify: `components/notes/LiveMarkdownEditor.tsx`
- Test: `components/notes/LiveMarkdownEditor.test.tsx`
- Sync: `/home/amine/wasl-local/components/notes/LiveMarkdownEditor.tsx`, `components/notes/LiveMarkdownEditor.test.tsx`

**Interfaces:**
- `LiveMarkdownEditor`:
  - Props: `value: string`, `onChange: (val: string) => void`, `onBlur?: () => void`, `placeholder?: string`
  - Ref: `insertSnippet(snippet: string)`, `applyFormatting(prefix: string, suffix?: string)`, `formatBlock(tag: string)`, `focus()`

- [ ] **Step 1: Write tests in `LiveMarkdownEditor.test.tsx`**
Test live rendering, text editing, toolbar formatting commands, and task checkbox toggling.

- [ ] **Step 2: Implement `LiveMarkdownEditor.tsx`**
Implement the unified `contentEditable` document canvas with:
- Clean typography and single fluid document flow (no block borders or discrete cards).
- Live formatting shortcuts (`# `, `## `, `- `, `* `, `1. `, `[ ] `, `> `).
- Bidirectional Markdown <-> HTML conversion engine (`markdownToHtml` and `htmlToMarkdown`).
- Interactive task checklist click handling.
- Inline responsive image rendering.

- [ ] **Step 3: Run unit tests**
Run `npx vitest run components/notes/LiveMarkdownEditor.test.tsx`.

---

### Task 4: Connect Toolbar & Auto-Save in `NoteForm.tsx`

**Files:**
- Modify: `components/forms/NoteForm.tsx`
- Test: `components/forms/NoteForm.test.tsx`
- Sync: `/home/amine/wasl-local/components/forms/NoteForm.tsx`, `components/forms/NoteForm.test.tsx`

- [ ] **Step 1: Update `NoteForm.tsx` formatting actions**
Connect `applyFormatting` and `formatBlock` directly to the `LiveMarkdownEditor` ref for instant bold, italic, heading (H1, H2, H3), list, task list, quote, code, and image actions.

- [ ] **Step 2: Run `NoteForm.test.tsx`**
Run `npx vitest run components/forms/NoteForm.test.tsx`.

---

### Task 5: Edition Parity, Full Verification & Build Validation

**Files:**
- Both repositories: `/home/amine/wasl-cloud` and `/home/amine/wasl-local`

- [ ] **Step 1: Sync all updated files to `wasl-local`**
- [ ] **Step 2: Run test suite in `wasl-cloud` (`npm test`)**
- [ ] **Step 3: Run test suite in `wasl-local` (`npm test`)**
- [ ] **Step 4: Run typecheck and linting in both repos**
- [ ] **Step 5: Run production builds (`npm run build:cloud`, `npm run build:local`, `npm run build`)**
- [ ] **Step 6: Update walkthrough artifact**
