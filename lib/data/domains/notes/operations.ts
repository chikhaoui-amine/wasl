import type { NotesPersistedState } from "../../types";

export type NoteTag = string;

export type NoteContentType = "note" | "read" | "listen" | "idea";

export interface NoteCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  linkedCategoryIds?: string[];
}

export interface Note {
  id: string;
  title: string;
  body: string;
  tag: string;
  pinned: boolean;
  updatedAt: number; // epoch ms
  contentType?: NoteContentType;
  sourceUrl?: string;
  author?: string;
}

export interface NoteInput {
  title: string;
  body: string;
  tag: string;
  pinned?: boolean;
  contentType?: NoteContentType;
  sourceUrl?: string;
  author?: string;
}

export const DEFAULT_CATEGORIES: NoteCategory[] = [
  { id: "cat-personal", name: "Personal", color: "var(--success)" },
  { id: "cat-idea", name: "Idea", color: "var(--accent)" },
  { id: "cat-draft", name: "Draft", color: "var(--warn)" },
  { id: "cat-reference", name: "Reference", color: "var(--accent-2)" },
];

export const NOTE_TAGS: string[] = ["Personal", "Idea", "Draft", "Reference"];

export function createDefaultNotesState(): NotesPersistedState {
  const now = Date.now();
  return {
    notes: [
      {
        id: "note-sample-1",
        title: "Welcome to WASL: Personal Knowledge Architecture",
        body: `# Welcome to WASL Notes

WASL is designed as an interconnected personal operating system where your thoughts, goals, and knowledge reinforce each other.

### Key Workflows
* **Connected Context**: Link notes to **Goals** and **Learning Topics**.
* **AI-Native MCP**: Your AI assistant can read, summarize, and synthesize your notes across all domains.
* **Markdown Support**: Use full markdown syntax, checklists, and code snippets.

> *"Systems thinking is the practice of seeing wholes rather than parts."*`,
        tag: "Philosophy & Growth",
        pinned: true,
        updatedAt: now - 3600000,
        contentType: "note",
      },
      {
        id: "note-sample-2",
        title: "Deep Work Protocols & Focus Rituals",
        body: `# Deep Work Protocols

1. **Clear Distractions**: Phone out of room, notifications muted.
2. **Defined Output**: Know the exact milestone to finish before opening the editor.
3. **Time-box**: 90-minute immersion blocks with 15-minute physical reset.

### Focus Checklist
- [x] Establish daily top 3 priorities
- [x] Protect morning hours (9:00 - 11:30)
- [ ] Log energy rating in Journal`,
        tag: "Personal",
        pinned: false,
        updatedAt: now - 7200000,
        contentType: "note",
      },
      {
        id: "note-sample-3",
        title: "Endurance Running & Zone 2 Protocols",
        body: `# Aerobic Base & Zone 2

- **Target Heart Rate**: 60-70% max HR (conversational pace).
- **Frequency**: 3-4 sessions per week for mitochondrial density.
- **Nutrition**: Hydration + electrolyte replenishment post-run.`,
        tag: "Reference",
        pinned: false,
        updatedAt: now - 14400000,
        contentType: "note",
      },
    ],
    categories: DEFAULT_CATEGORIES,
  };
}

export function normalizeNotesState(raw: unknown): NotesPersistedState {
  if (!raw || typeof raw !== "object") {
    return createDefaultNotesState();
  }
  const obj = raw as Partial<NotesPersistedState>;
  const notes = Array.isArray(obj.notes)
    ? obj.notes.map((n) => ({
        ...n,
        contentType: n.contentType || "note",
        pinned: Boolean(n.pinned),
        updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
      }))
    : [];
  const categories = Array.isArray(obj.categories) && obj.categories.length > 0
    ? obj.categories
    : DEFAULT_CATEGORIES;

  return {
    notes,
    categories,
    graphPositions: obj.graphPositions && typeof obj.graphPositions === "object" ? obj.graphPositions as NotesPersistedState["graphPositions"] : {},
  };
}

export function updateGraphPositionOperation(
  current: NotesPersistedState | null | undefined,
  nodeId: string,
  position: { x: number; y: number },
): NotesPersistedState {
  const base = normalizeNotesState(current);
  return { ...base, graphPositions: { ...(base.graphPositions || {}), [nodeId]: position } };
}

export function addNoteOperation(
  current: NotesPersistedState | null | undefined,
  note: Note,
): NotesPersistedState {
  const base = normalizeNotesState(current);
  return {
    ...base,
    notes: [note, ...base.notes],
  };
}

export function updateNoteOperation(
  current: NotesPersistedState | null | undefined,
  id: string,
  patch: Partial<NoteInput>,
  now: number = Date.now(),
): NotesPersistedState {
  const base = normalizeNotesState(current);
  return {
    ...base,
    notes: base.notes.map((n) =>
      n.id === id ? { ...n, ...patch, updatedAt: now } : n,
    ),
  };
}

export function togglePinOperation(
  current: NotesPersistedState | null | undefined,
  id: string,
): NotesPersistedState {
  const base = normalizeNotesState(current);
  return {
    ...base,
    notes: base.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)),
  };
}

export function deleteNoteOperation(
  current: NotesPersistedState | null | undefined,
  id: string,
): NotesPersistedState {
  const base = normalizeNotesState(current);
  return {
    ...base,
    notes: base.notes.filter((n) => n.id !== id),
  };
}

export function addCategoryOperation(
  current: NotesPersistedState | null | undefined,
  category: NoteCategory,
): NotesPersistedState {
  const base = normalizeNotesState(current);
  return {
    ...base,
    categories: [...base.categories, category],
  };
}

export function updateCategoryOperation(
  current: NotesPersistedState | null | undefined,
  id: string,
  patch: Partial<{ name: string; color: string; icon?: string; linkedCategoryIds?: string[] }>,
): NotesPersistedState {
  const base = normalizeNotesState(current);
  return {
    ...base,
    categories: base.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

export function deleteCategoryOperation(
  current: NotesPersistedState | null | undefined,
  id: string,
  now: number = Date.now(),
): NotesPersistedState {
  const base = normalizeNotesState(current);
  const targetCat = base.categories.find((c) => c.id === id);
  const updatedCategories = base.categories
    .filter((c) => c.id !== id)
    .map((c) => ({
      ...c,
      linkedCategoryIds: c.linkedCategoryIds?.filter((lid) => lid !== id),
    }));
  const defaultTagName = updatedCategories[0]?.name || "Personal";

  const updatedNotes = targetCat
    ? base.notes.map((n) =>
        n.tag.toLowerCase() === targetCat.name.toLowerCase()
          ? { ...n, tag: defaultTagName, updatedAt: now }
          : n,
      )
    : base.notes;

  return {
    categories: updatedCategories.length > 0 ? updatedCategories : DEFAULT_CATEGORIES,
    notes: updatedNotes,
  };
}

export function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}
