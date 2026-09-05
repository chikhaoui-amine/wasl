"use client";

import { BookOpen, ExternalLink, Headphones, Lightbulb, Pencil, Pin, StickyNote, Trash2 } from "lucide-react";
import { useNotesData, relTime, type Note, type NoteCategory, type NoteContentType } from "@/lib/data/domains/notes";
import { isRtlText } from "@/components/ui/MarkdownRenderer";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<NoteContentType, typeof StickyNote> = {
  note: StickyNote,
  read: BookOpen,
  listen: Headphones,
  idea: Lightbulb,
};

interface NoteListViewProps {
  notes: Note[];
  categories: NoteCategory[];
  onRead: (note: Note) => void;
  onEdit: (note: Note) => void;
  onNewNote: () => void;
}

export function NoteListView({
  notes,
  categories,
  onRead,
  onEdit,
  onNewNote,
}: NoteListViewProps) {
  const { togglePin, deleteNote } = useNotesData();

  if (notes.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-sm text-faint">No notes available in this view.</p>
        <button
          onClick={onNewNote}
          className="mt-3 text-xs font-semibold text-accent hover:underline"
        >
          + Create a new note
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface-1/90 backdrop-blur-md shadow-xs divide-y divide-border/50">
      {notes.map((note) => {
        const cat = categories.find((c) => c.name.toLowerCase() === note.tag.toLowerCase());
        const catColor = cat?.color || "var(--accent)";
        const contentType: NoteContentType = note.contentType || "note";
        const Icon = TYPE_ICONS[contentType] || StickyNote;
        const words = note.body ? note.body.trim().split(/\s+/).filter(Boolean).length : 0;

        return (
          <div
            key={note.id}
            onClick={() => onRead(note)}
            className={cn(
              "group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 sm:p-4 transition-colors hover:bg-surface-2/60 cursor-pointer",
              note.pinned && "bg-accent/5",
            )}
          >
            {/* Main Info - Title Only */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: `color-mix(in oklab, ${catColor} 15%, transparent)`,
                    color: catColor,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: catColor }} />
                  {note.tag}
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-faint font-medium">
                  <Icon className="h-2.5 w-2.5" />
                  {contentType}
                </span>

                {note.section && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-accent">
                    {note.section}
                  </span>
                )}

                {note.pinned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                    <Pin className="h-2.5 w-2.5 fill-current rotate-45" /> Pinned
                  </span>
                )}
              </div>

              <h4
                dir={isRtlText(note.title) ? "rtl" : "ltr"}
                className="font-display text-sm sm:text-[15px] font-bold text-text group-hover:text-accent transition-colors truncate"
              >
                {note.title}
              </h4>
            </div>

            {/* Right Metadata & Action Buttons */}
            <div
              className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 text-xs text-faint"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <span>{relTime(note.updatedAt)}</span>
                {words > 0 && <span className="hidden md:inline">· {words} words</span>}
              </div>

              {note.sourceUrl && (
                <a
                  href={note.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-accent hover:underline text-[11px]"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(note)}
                  title="Edit note"
                  className="grid h-7 w-7 place-items-center rounded-lg hover:bg-surface-2 hover:text-accent transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => togglePin(note.id)}
                  title={note.pinned ? "Unpin note" : "Pin note"}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-surface-2",
                    note.pinned ? "text-accent" : "text-faint hover:text-muted",
                  )}
                >
                  <Pin className={cn("h-3.5 w-3.5", note.pinned && "fill-current")} style={{ rotate: "45deg" }} />
                </button>

                <button
                  onClick={() => deleteNote(note.id)}
                  title="Delete note"
                  className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-danger/10 hover:text-danger transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
