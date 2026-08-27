"use client";

import { useEffect, useState } from "react";
import { useNotesData, relTime, type Note, type NoteContentType } from "@/lib/data/domains/notes";
import { MarkdownRenderer, isRtlText } from "@/components/ui/MarkdownRenderer";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Headphones,
  Lightbulb,
  Pencil,
  Pin,
  StickyNote,
  Trash2,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<NoteContentType, typeof StickyNote> = {
  note: StickyNote,
  read: BookOpen,
  listen: Headphones,
  idea: Lightbulb,
};

const TYPE_LABELS: Record<NoteContentType, string> = {
  note: "Note",
  read: "Read",
  listen: "Listen",
  idea: "Idea",
};

interface NoteDetailProps {
  note?: Note;
  onClose: () => void;
  onEdit: () => void;
}

export function NoteDetail({ note, onClose, onEdit }: NoteDetailProps) {
  const { togglePin, deleteNote, categories } = useNotesData();
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && note) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [note, onClose]);

  if (!note) return null;

  const category = categories.find((c) => c.name.toLowerCase() === note.tag.toLowerCase());
  const categoryColor = category?.color || "var(--accent)";
  const contentType: NoteContentType = note.contentType || "note";
  const Icon = TYPE_ICONS[contentType] || StickyNote;

  const words = note.body ? note.body.trim().split(/\s+/).length : 0;
  const readTimeMin = Math.max(1, Math.ceil(words / 200));

  const handleCopy = () => {
    navigator.clipboard.writeText(`# ${note.title}\n\n${note.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    try {
      await deleteNote(note.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg/95 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Sticky Top Control Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-bg/80 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          {/* Back & Metadata Pills */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-surface-2 hover:border-accent"
            >
              <ArrowLeft className="h-4 w-4 text-accent" />
              <span className="hidden sm:inline">Back to Notes</span>
            </button>

            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: `color-mix(in oklab, ${categoryColor} 16%, transparent)`,
                color: categoryColor,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: categoryColor }}
              />
              {note.tag}
            </span>

            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
              <Icon className="h-3.5 w-3.5" />
              {TYPE_LABELS[contentType]}
            </span>
          </div>

          {/* Controls: Copy, Pin, Edit, Delete, Close */}
          <div className="flex items-center gap-1.5">
            <span className="hidden md:inline-block text-xs font-medium text-faint mr-2">
              {words} words · {readTimeMin} min read
            </span>

            <button
              onClick={handleCopy}
              title="Copy markdown content"
              className="flex items-center gap-1 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" />
                  <span className="hidden sm:inline text-success font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </button>

            <button
              onClick={() => togglePin(note.id)}
              title={note.pinned ? "Unpin note" : "Pin note to top"}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-1 transition-colors hover:bg-surface-2",
                note.pinned ? "text-accent border-accent/40" : "text-faint hover:text-muted",
              )}
            >
              <Pin className={cn("h-4 w-4", note.pinned && "fill-current")} style={{ rotate: "45deg" }} />
            </button>

            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm transition-all hover:brightness-110 active:scale-95"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Note</span>
            </button>

            <button
              onClick={handleDelete}
              title="Delete note"
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-1 text-faint transition-colors hover:bg-danger/10 hover:text-danger hover:border-danger/30"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <button
              onClick={onClose}
              title="Close reader view"
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-1 text-muted transition-colors hover:bg-surface-2 hover:text-text ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Document Reader Content Body */}
      <main className="mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-14 space-y-6">
        {/* Document Header Info */}
        <header className="space-y-4 border-b border-border/60 pb-6">
          <h1
            dir={isRtlText(note.title) ? "rtl" : "ltr"}
            className={cn(
              "font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-text leading-tight",
              isRtlText(note.title) ? "text-right" : "text-left",
            )}
          >
            {note.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-muted pt-1">
            <div className="flex flex-wrap items-center gap-3">
              {note.author && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-accent">
                  <User className="h-4 w-4" />
                  By {note.author}
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 text-faint">
                <Calendar className="h-4 w-4" />
                Updated {relTime(note.updatedAt)}
              </span>
            </div>

            {note.sourceUrl && (
              <a
                href={note.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline rounded-full bg-accent/10 px-3 py-1 text-xs"
              >
                Source <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </header>

        {/* Rendered Document Body */}
        <article className="min-h-[300px] pt-2">
          {note.body ? (
            <MarkdownRenderer content={note.body} />
          ) : (
            <p className="italic text-base text-faint text-center py-12">
              This note is empty. Click <strong className="text-accent">Edit Note</strong> to add insights.
            </p>
          )}
        </article>
      </main>
    </div>
  );
}
