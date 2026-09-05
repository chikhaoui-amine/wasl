# Note Page Custom Dividing Sections & Status Tags Design

**Date**: 2026-09-05  
**Topic**: Note Page Sections / Status Tags  
**Status**: Approved & Spec Review  

---

## 1. Overview & Goals

In WASL, notes are organized under custom pages (technically stored as `NoteCategory`, e.g. *Ideas*, *Personal*, *Drafts*). Currently, within a page, notes are displayed in a single unorganized stream or grid.

This feature enables users to define **custom dividing sections / status tags** for a specific note page (for example, inside *Ideas*, dividing the page into **Approved** and **Rejected**). Notes inside that page can be assigned to one of these sections, causing the page to visually divide into vertical stacked sections with:
1. **Inbox / Unsorted** section at the top for uncategorized or newly created notes.
2. **Configured Sections** stacked vertically below (e.g. `Approved`, `Rejected`), each displaying its title, count badge, and note cards.
3. **Dual Triage Interactions**:
   - **Quick-switch Pill**: 1-click status badge on note cards to immediately switch sections.
   - **Drag & Drop**: Native drag-and-drop between sections with visual drop target feedback.
4. **Full MCP Tool Support**: Complete AI capability to inspect, add, change, and remove note sections and page section definitions via MCP across both `wasl-cloud` and `wasl-local`.

---

## 2. Architecture & Edition Parity

WASL operates across two editions that must remain strictly synchronized in features while respecting architectural boundaries:
- **`wasl-local` (`/home/amine/wasl-local`)**: 100% offline, zero-auth, IndexedDB via Dexie (`LocalAdapter`).
- **`wasl-cloud` (`/home/amine/wasl-cloud`)**: Cloud edition with Supabase Auth, Postgres snapshots, Cloud Sync (`CloudAdapter`).

All data layer modifications follow the `DataAdapter` abstraction with serialized mutations and zero-data-loss migrations.

---

## 3. Data Schema & Persistence

### 3.1 Domain Types (`lib/data/domains/notes/types.ts`)
```typescript
export interface NoteCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  linkedCategoryIds?: string[];
  sections?: string[]; // e.g. ["Approved", "Rejected"]
}

export interface Note {
  id: string;
  title: string;
  body: string;
  tag: string;         // Category / Page name (e.g., "Ideas")
  pinned: boolean;
  updatedAt: number;
  contentType?: NoteContentType;
  sourceUrl?: string;
  author?: string;
  section?: string;    // e.g., "Approved" (undefined = Unsorted / Inbox)
}

export interface NoteInput {
  title: string;
  body: string;
  tag: string;
  pinned?: boolean;
  contentType?: NoteContentType;
  sourceUrl?: string;
  author?: string;
  section?: string;
}
```

### 3.2 Pure Migrations & Schema Drift Safety
- **`lib/data/migrations.ts`**: Update the `notes` and `categories` migration functions in `DOMAIN_MIGRATIONS` so older snapshots gracefully receive `sections: []` on categories and `section: undefined` on notes.
- **`lib/data/validation/domain-schemas.ts`**: Update Zod validation schemas for `Note` (`section: z.string().optional()`) and `NoteCategory` (`sections: z.array(z.string()).optional()`).
- **`lib/data/schema-drift.test.ts`**: Verify validation schemas align with runtime types.

---

## 4. MCP System Integration

To ensure the AI agent can triage, categorize, and configure sections seamlessly, MCP tools are updated across all four designated registry files:

1. **`lib/ai/tools.ts`** (Cloud Tool Implementations)
2. **`app/api/[transport]/route.ts`** (Cloud Tool Registrations & Zod shapes)
3. **`packages/wasl-mcp-local/src/tool-definitions.ts`** (Local STDIO tool definitions)
4. **`lib/relay/local-executor.ts`** (Local relay executor)

### Tool Changes:
- **`notes_create`**: Add optional `section` parameter.
- **`notes_update`**: Add optional `section` parameter (pass a string to set, or empty string/null to move back to Unsorted).
- **`notes_get`, `notes_list`, `notes_search`**: Include `section` in note payloads.
- **`note_categories_create`**: Add optional `sections` array parameter.
- **`note_categories_update`**: Add optional `sections` array parameter to add, remove, or reorder section tags for the page.

---

## 5. UI & Interaction Design

### 5.1 Page Settings (`components/forms/CategoryForm.tsx`)
- In `CategoryForm`, underneath Page Name and Color, add an interactive **"Page Sections / Status Tags"** manager:
  - Input field to type a section name and press Enter or click `+ Add`.
  - Chip list showing existing sections with reorder controls and a `✕` delete button.
  - Clean helper text: *"Notes in this page will be divided into these vertical sections."*

### 5.2 Vertical Sectioned Layout (`app/notes/page.tsx`)
When a category is selected (`selectedCategory !== "All"`):
- If the category has `sections` defined and non-empty:
  - **Inbox / Unsorted (Top)**:
    - Displayed if there are notes without a `section` (or where `section` does not match any valid category section).
    - Header: `📥 Inbox / Unsorted` with count badge.
    - Notes displayed in a responsive grid.
  - **Configured Sections (Stacked Vertically)**:
    - Stacked vertically, non-collapsible, clear title with tag icon and count badge (e.g., `🏷️ Approved (3)`).
    - Under the header, notes belonging to that section render in a responsive grid.
    - If empty, displays a subtle dashed drop area: *"Drop notes here to mark as [Section Name]"*.
- If the category has NO sections defined:
  - Renders the existing standard unified view (Grid / Split / List) without clutter.

### 5.3 Quick-Switch Pill & Drag-and-Drop
- **`NoteCard` (`app/notes/page.tsx` or `components/notes/NoteCard.tsx`)**:
  - In sectioned pages, the card shows a status pill (e.g., `[Approved ▾]` or `[Unsorted ▾]`).
  - Clicking the pill opens a menu of the page's sections + Unsorted. Clicking any section immediately updates `note.section` and smoothly moves the card.
  - HTML5 drag-and-drop: Note cards are `draggable`. Dragging over a section highlights the section drop zone; dropping reassigns `note.section` instantly.

### 5.4 Note Editor Modal (`components/forms/NoteForm.tsx`)
- If the selected category has sections configured, display a **Section** dropdown in `NoteForm` (options: `Unsorted / Inbox`, plus configured sections) so the user can choose or change the section while creating or editing notes.

---

## 6. Verification & Quality Gates

1. **Typecheck & Linter**:
   - `npm run lint` (0 errors)
   - `npx tsc --noEmit` / `npm run typecheck`
2. **Vitest Unit Tests**:
   - `npm test` (verify domain migrations, schema drift tests, and note domain hooks)
   - Add new tests for category sections and note section assignments.
3. **Build Verifications**:
   - `npm run build:local`
   - `npm run build:cloud`
   - `npm run build:mcp`
