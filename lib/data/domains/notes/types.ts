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
  tag: string; // Category name or ID (e.g., "Personal", "Idea", "Draft")
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
