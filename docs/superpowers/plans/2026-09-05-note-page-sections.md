# Note Page Custom Dividing Sections & Status Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users and AI assistants to define custom dividing sections / status tags for specific note pages (e.g. "Approved" and "Rejected" for "Ideas"), with 1-click status pills, drag-and-drop triage, and full MCP tool support across `wasl-local` and `wasl-cloud`.

**Architecture:** Extends `NoteCategory` with optional `sections?: string[]` and `Note` with optional `section?: string`. Extends pure migrations in `DOMAIN_MIGRATIONS` and Zod validation schemas for zero data loss. Updates all 4 MCP tool definition layers. Renders vertical stacked sections in `app/notes/page.tsx` when a page has sections defined, with quick-switch pill menus, HTML5 drag-and-drop, and section selection in `CategoryForm` and `NoteForm`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Dexie (IndexedDB) for Local edition, Supabase & MCP SSE for Cloud edition, Vitest for unit testing.

## Global Constraints
- **Dual-Edition Parity**: Implement all changes across both `/home/amine/wasl-cloud` and `/home/amine/wasl-local`.
- **Zero Data Loss**: Always use pure functions in `DOMAIN_MIGRATIONS`; never return empty arrays on version mismatch.
- **MCP Synchronization**: Keep `lib/ai/tools.ts`, `app/api/[transport]/route.ts`, `packages/wasl-mcp-local/src/tool-definitions.ts`, and `lib/relay/local-executor.ts` strictly aligned.
- **Strict Lint & Typecheck**: No `any` shortcuts, 0 linter errors, passing tests and builds before completion.

---

### Task 1: Domain Types, Schema Validation & Pure Migrations

**Files:**
- Modify: `lib/data/domains/notes/types.ts`
- Modify: `lib/data/domains/notes/operations.ts`
- Modify: `lib/data/domains/notes/migrations.ts`
- Modify: `lib/data/validation/domain-schemas.ts`
- Test: `lib/data/domains/notes/migrations.test.ts` (or create if needed)
- Test: `lib/data/schema-drift.test.ts`

**Interfaces:**
- Consumes: Existing `Note`, `NoteCategory`, `NotesPersistedState`
- Produces:
  - `NoteCategory.sections?: string[]`
  - `Note.section?: string`
  - `NoteInput.section?: string`
  - Updated Zod `NoteSchema` and `NoteCategorySchema`

- [ ] **Step 1: Write failing unit test for note & category migrations**

Create or update `lib/data/domains/notes/migrations.test.ts` verifying that `migrateNotesSnapshot` preserves `sections` on categories and `section` on notes, and supplies safe defaults for older snapshots.

```typescript
import { describe, it, expect } from "vitest";
import { migrateNotesSnapshot, CURRENT_NOTES_VERSION } from "./migrations";

describe("migrateNotesSnapshot with sections", () => {
  it("preserves category sections and note section on current version", () => {
    const raw = {
      notes: [
        { id: "n1", title: "Idea 1", body: "text", tag: "Ideas", section: "Approved" },
      ],
      categories: [
        { id: "c1", name: "Ideas", color: "#37c9b7", sections: ["Approved", "Rejected"] },
      ],
    };
    const migrated = migrateNotesSnapshot(raw, CURRENT_NOTES_VERSION);
    expect(migrated.categories[0].sections).toEqual(["Approved", "Rejected"]);
    expect(migrated.notes[0].section).toBe("Approved");
  });

  it("handles older snapshots without sections cleanly", () => {
    const raw = {
      notes: [{ id: "n2", title: "Old", body: "old", tag: "Personal" }],
      categories: [{ id: "c2", name: "Personal", color: "#10b981" }],
    };
    const migrated = migrateNotesSnapshot(raw, 2);
    expect(migrated.categories[0].sections).toBeUndefined();
    expect(migrated.notes[0].section).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test lib/data/domains/notes/migrations.test.ts`
Expected: FAIL due to missing type properties or assertion failures.

- [ ] **Step 3: Update domain types, operations, and migrations**

1. In `lib/data/domains/notes/types.ts`:
   Add `sections?: string[];` to `NoteCategory`.
   Add `section?: string;` to `Note` and `NoteInput`.
2. In `lib/data/domains/notes/operations.ts`:
   Mirror types: add `sections?: string[]` to `NoteCategory`, `section?: string` to `Note` and `NoteInput`.
   Update `normalizeNotesState`: ensure `sections` and `section` are preserved when mapping notes and categories.
3. In `lib/data/domains/notes/migrations.ts`:
   Ensure `existingNotes` maps `section: typeof n.section === "string" ? n.section : undefined`.
   Ensure `existingCategories` maps `sections: Array.isArray(c.sections) ? c.sections.map(String) : undefined`.
4. In `lib/data/validation/domain-schemas.ts`:
   Add `sections: z.array(z.string()).optional()` to `NoteCategorySchema`.
   Add `section: z.string().optional()` to `NoteSchema`.

- [ ] **Step 4: Run tests and schema drift test**

Run: `npm test lib/data/domains/notes/migrations.test.ts lib/data/schema-drift.test.ts`
Expected: PASS

- [ ] **Step 5: Apply to both `wasl-cloud` and `wasl-local` and commit**

Run:
```bash
git add lib/data/domains/notes/types.ts lib/data/domains/notes/operations.ts lib/data/domains/notes/migrations.ts lib/data/validation/domain-schemas.ts lib/data/domains/notes/migrations.test.ts
git commit -m "feat(notes): add section and sections to note and category schemas"
```

---

### Task 2: Domain Hooks & Operations for Notes and Categories

**Files:**
- Modify: `lib/data/domains/notes/operations.ts`
- Modify: `lib/data/domains/notes/hooks.ts`
- Test: `lib/data/domains/notes/operations.test.ts` (or existing tests)

**Interfaces:**
- Consumes: Updated `Note`, `NoteCategory`, `NoteInput`
- Produces:
  - `addCategory({ name, color, icon, linkedCategoryIds, sections })`
  - `updateCategory(id, { name?, color?, icon?, linkedCategoryIds?, sections? })`
  - `addNote({ title, body, tag, section, ... })`
  - `updateNote(id, { title?, body?, tag?, section?, ... })`
  - Helper `setNoteSection(id, section?: string)`

- [ ] **Step 1: Write test for category and note section operations**

```typescript
it("updates note section via updateNoteOperation", () => {
  const state = createDefaultNotesState();
  const noteId = state.notes[0].id;
  const next = updateNoteOperation(state, noteId, { section: "Approved" });
  expect(next.notes.find((n) => n.id === noteId)?.section).toBe("Approved");
});

it("updates category sections via updateCategoryOperation", () => {
  const state = createDefaultNotesState();
  const catId = state.categories[0].id;
  const next = updateCategoryOperation(state, catId, { sections: ["Backlog", "In Review"] });
  expect(next.categories.find((c) => c.id === catId)?.sections).toEqual(["Backlog", "In Review"]);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test lib/data/domains/notes/`
Expected: FAIL (missing `sections` on category patch or types).

- [ ] **Step 3: Implement operations and update hooks**

In `lib/data/domains/notes/operations.ts`:
- Update `addCategoryOperation` to accept `sections?: string[]`.
- Update `updateCategoryOperation` to accept `sections?: string[]`.
- Update `updateNoteOperation` to accept `section?: string`.

In `lib/data/domains/notes/hooks.ts`:
- Pass `sections` in `addCategory` and `updateCategory`.
- Expose `setNoteSection: (id: string, section?: string) => Promise<void>` as a convenience helper:
  ```typescript
  const setNoteSection = (id: string, section?: string) => updateNote(id, { section });
  ```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test lib/data/domains/notes/ && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Apply to both `wasl-cloud` and `wasl-local` and commit**

```bash
git add lib/data/domains/notes/operations.ts lib/data/domains/notes/hooks.ts lib/data/domains/notes/operations.test.ts
git commit -m "feat(notes): support section updates in domain operations and hooks"
```

---

### Task 3: MCP Tooling Parity across Cloud & Local

**Files:**
- Modify: `lib/ai/tools.ts`
- Modify: `app/api/[transport]/route.ts`
- Modify: `packages/wasl-mcp-local/src/tool-definitions.ts`
- Modify: `lib/relay/local-executor.ts`
- Test: `app/api/[transport]/route.test.ts`
- Test: `lib/relay/local-executor.test.ts`

**Interfaces:**
- Consumes: MCP tool registry
- Produces:
  - `add_note` / `notes_create`: accepts `section?: string`
  - `update_note` / `notes_update`: accepts `section?: string`
  - `add_note_category` / `note_categories_create`: accepts `sections?: string[]`
  - `update_note_category` / `note_categories_update`: accepts `sections?: string[]`
  - `notes_list`, `notes_search`, `notes_get`: includes `section` in item summary
  - `note_categories_list`, `note_categories_get`: includes `sections` in category summary

- [ ] **Step 1: Write failing tests in `route.test.ts` and `local-executor.test.ts`**

Add tests verifying:
1. `notes_create` input schema has property `section`.
2. `note_categories_create` input schema has property `sections`.
3. `local-executor` successfully stores and returns `section` on notes and `sections` on categories.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test app/api/[transport]/route.test.ts lib/relay/local-executor.test.ts`
Expected: FAIL

- [ ] **Step 3: Update all 4 MCP tool definition layers**

1. In `packages/wasl-mcp-local/src/tool-definitions.ts`:
   - `add_note`: add `section: z.string().optional().describe("Section / status tag (e.g. 'Approved', 'Rejected')")`
   - `update_note`: add `section: z.string().optional().describe("New section / status tag, or empty string to clear")`
   - `add_note_category`: add `sections: z.array(z.string()).optional().describe("Dividing sections / status tags for this page")`
   - `update_note_category`: add `sections: z.array(z.string()).optional().describe("Updated sections list for this page")`
2. In `app/api/[transport]/route.ts`:
   - Update `add_note`, `update_note`, `add_note_category`, `update_note_category` Zod schemas to include `section` and `sections`.
3. In `lib/ai/tools.ts`:
   - Update `noteSummary` to include `section: typeof raw.section === "string" ? raw.section : undefined`.
   - Update `addNote` / `updateNote` handlers to pass `section`.
   - Update `noteCategoriesList` / `noteCategoriesGet` to include `sections: Array.isArray(raw.sections) ? raw.sections : []`.
   - Update `addCategory` / `updateCategory` to accept and persist `sections`.
4. In `lib/relay/local-executor.ts`:
   - In `add_note`: store `section: typeof args.section === "string" ? args.section.trim() : undefined`.
   - In `update_note`: update `section: typeof args.section === "string" ? (args.section.trim() || undefined) : n.section`.
   - In `note_categories_list` & `note_categories_get`: include `sections: item.sections ?? []`.
   - In `add_note_category`: store `sections: Array.isArray(args.sections) ? args.sections.map(String) : undefined`.
   - In `update_note_category`: update `sections: Array.isArray(args.sections) ? args.sections.map(String) : item.sections`.

- [ ] **Step 4: Rebuild MCP package and run tests**

Run:
```bash
npm run build:mcp
npm test app/api/[transport]/route.test.ts lib/relay/local-executor.test.ts
```
Expected: PASS

- [ ] **Step 5: Apply to both `wasl-cloud` and `wasl-local` and commit**

```bash
git add lib/ai/tools.ts app/api/[transport]/route.ts packages/wasl-mcp-local/src/tool-definitions.ts lib/relay/local-executor.ts app/api/[transport]/route.test.ts lib/relay/local-executor.test.ts
git commit -m "feat(mcp): add section and sections to note and category mcp tools"
```

---

### Task 4: UI - Page Sections Configuration in `CategoryForm`

**Files:**
- Modify: `components/forms/CategoryForm.tsx`
- Test: Visual & component render test

**Interfaces:**
- Consumes: `CategoryFormProps`, `useNotesData`
- Produces: Interactive Section / Tag manager inside the category modal

- [ ] **Step 1: Enhance `CategoryForm` with Section Tags Editor**

In `components/forms/CategoryForm.tsx`:
- Add local state `sections: string[]` initialized to `category?.sections ?? []`.
- Add local state `newSectionInput: string` for typing new section names.
- Provide functions:
  - `addSection(name: string)`: trims, prevents duplicates, appends to `sections`.
  - `removeSection(index: number)`: removes section at index.
  - `moveSection(index: number, direction: 'up' | 'down')`: reorders sections.
- Render under color picker:
  - Input field with `+ Add` button and Enter-key listener.
  - Interactive chips list showing `[🏷️ Section Name  ✕]`.
  - Helper note: *"Notes in this page will be divided into these vertical sections."*
- On form submit, pass `sections` to `addCategory` and `updateCategory`.

- [ ] **Step 2: Typecheck & lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Apply to both `wasl-cloud` and `wasl-local` and commit**

```bash
git add components/forms/CategoryForm.tsx
git commit -m "feat(ui): add section tag manager to CategoryForm"
```

---

### Task 5: UI - Vertical Sections Layout, Dropdown Pill & Drag-and-Drop in Notes

**Files:**
- Modify: `app/notes/page.tsx`
- Modify: `components/forms/NoteForm.tsx`
- Test: Component and layout integration

**Interfaces:**
- Consumes: `notes`, `categories`, `updateNote`
- Produces:
  - Clean vertical section display when page has `sections` configured
  - Status pill dropdown on note cards
  - Drag-and-drop between sections
  - Section selector in `NoteForm`

- [ ] **Step 1: Add Section Selector to `NoteForm`**

In `components/forms/NoteForm.tsx`:
- Inspect the selected category to see if it has `sections?: string[]`.
- If it has sections, render a clean Section / Status dropdown:
  - Options: `Unsorted / Inbox`, plus each configured section (`Approved`, `Rejected`, etc.).
  - Bind to `section` in note state and pass to `addNote` / `updateNote`.

- [ ] **Step 2: Implement Quick-Switch Pill & Drag Support in NoteCard**

In `app/notes/page.tsx`:
- In `NoteCard`:
  - Accept `availableSections?: string[]` and `onSelectSection?: (section?: string) => void`.
  - If `availableSections` has items:
    - Display a clickable status pill: `[Approved ▾]` or `[Unsorted ▾]`.
    - Dropdown menu appears on click, listing available sections + `Unsorted / Clear`.
    - Clicking updates the note's section immediately.
  - Add native HTML5 drag attributes:
    - `draggable={Boolean(availableSections && availableSections.length > 0)}`
    - `onDragStart={(e) => { e.dataTransfer.setData("text/plain", note.id); e.dataTransfer.effectAllowed = "move"; }}`

- [ ] **Step 3: Implement Vertical Sectioned Board Layout in `NotesPage`**

In `app/notes/page.tsx`:
- When `selectedCategory !== "All"`:
  - Find active category: `currentCat = categories.find(c => c.name.toLowerCase() === selectedCategory.toLowerCase())`.
  - If `currentCat?.sections && currentCat.sections.length > 0`:
    - Group notes for this page:
      - `unsortedNotes = notes.filter(n => !n.section || !currentCat.sections.includes(n.section))`
      - For each section `s`: `sectionNotes[s] = notes.filter(n => n.section === s)`
    - Render vertical stacked sections:
      1. **Inbox / Unsorted** (rendered at top if `unsortedNotes.length > 0` or as a designated drop zone).
      2. **Each configured section** in order (e.g. `Approved`, `Rejected`):
         - Section Header: Tag icon, section name, count pill (`3`), and `+ Note` quick add button for that section.
         - Droppable Container:
           - `onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}`
           - `onDrop={(e) => { const noteId = e.dataTransfer.getData("text/plain"); if (noteId) updateNote(noteId, { section: s }); }}`
         - Grid of `NoteCard` components.
         - If empty, render a stylish dashed drop target: *"Drop notes here to mark as [Section Name]"*.
  - If `currentCat?.sections` is empty or undefined:
    - Retain standard view (Grid / Split / List).

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors.

- [ ] **Step 5: Apply to both `wasl-cloud` and `wasl-local` and commit**

```bash
git add app/notes/page.tsx components/forms/NoteForm.tsx
git commit -m "feat(ui): implement vertical sections, drag-and-drop, and section pill in notes"
```

---

### Task 6: Full Verification Across Both Editions

**Files:**
- Both repositories: `/home/amine/wasl-cloud` and `/home/amine/wasl-local`

- [ ] **Step 1: Run comprehensive tests in both repositories**

```bash
# In wasl-cloud
npm run lint
npx tsc --noEmit
npm test
npm run build:local
npm run build:cloud
npm run build:mcp

# In wasl-local
npm run lint
npm run typecheck
npm test
npm run build
npm run build:mcp
```

- [ ] **Step 2: Manual walkthrough & verify UI**
- Open notes page in browser.
- Create a test page "Ideas" with sections `Approved` and `Rejected`.
- Create a note, verify it appears in `Inbox / Unsorted`.
- Click the pill and switch to `Approved` &rarr; note moves to Approved section.
- Drag note to `Rejected` &rarr; note moves to Rejected section.
- Test MCP tool `notes_update` with `section: "Approved"` &rarr; verifies AI tool integration.
