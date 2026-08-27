import type { NotesPersistedState } from "../../types";
import {
  normalizeNotesState,
  DEFAULT_CATEGORIES,
  type Note,
  type NoteCategory,
} from "./operations";

export const CURRENT_NOTES_VERSION = 3;

export function migrateNotesSnapshot(
  rawState: unknown,
  version: number,
): NotesPersistedState {
  if (version > CURRENT_NOTES_VERSION) {
    throw new Error(
      `Unsupported future Notes version ${version}. Current supported version is ${CURRENT_NOTES_VERSION}.`,
    );
  }

  if (version === CURRENT_NOTES_VERSION) {
    return normalizeNotesState(rawState);
  }

  // Older version migrations (< v3)
  const state = (rawState && typeof rawState === "object" ? rawState : {}) as Record<
    string,
    unknown
  > & { notes?: Note[]; categories?: NoteCategory[] };

  const rawNotes = Array.isArray(state?.notes) ? state.notes : [];
  const rawCategories = Array.isArray(state?.categories) ? state.categories : [];

  const existingNotes: Note[] = rawNotes.map((n) => ({
    id: typeof n.id === "string" && n.id ? n.id : crypto.randomUUID(),
    title: typeof n.title === "string" ? n.title : "",
    body: typeof n.body === "string" ? n.body : "",
    tag: typeof n.tag === "string" && n.tag ? n.tag : "Personal",
    pinned: Boolean(n.pinned),
    updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
    contentType: n.contentType || "note",
    sourceUrl: typeof n.sourceUrl === "string" ? n.sourceUrl : undefined,
    author: typeof n.author === "string" ? n.author : undefined,
  }));

  const existingCategories: NoteCategory[] =
    rawCategories.length > 0
      ? rawCategories.map((c) => ({
          id: typeof c.id === "string" && c.id ? c.id : `cat-${crypto.randomUUID()}`,
          name: typeof c.name === "string" ? c.name : "Category",
          color: typeof c.color === "string" ? c.color : "var(--accent)",
          icon: typeof c.icon === "string" ? c.icon : undefined,
        }))
      : DEFAULT_CATEGORIES;

  return {
    notes: existingNotes,
    categories: existingCategories,
  };
}
