"use client";

import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Headphones,
  Lightbulb,
  StickyNote,
  Pin,
  Trash2,
  Copy,
  Check,
  Eye,
  Edit3,
  ExternalLink,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  Bold,
  Italic,
  List,
  CheckSquare,
  Heading2,
  Heading3,
} from "lucide-react";
import {
  useNotesData,
  relTime,
  CoalescingSaveQueue,
  type Note,
  type NoteCategory,
  type NoteContentType,
  type SaveStatus,
} from "@/lib/data/domains/notes";
import { MarkdownRenderer, isRtlText } from "@/components/ui/MarkdownRenderer";
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

interface NoteSplitViewProps {
  notes: Note[];
  categories: NoteCategory[];
  activeNoteId?: string;
  onSelectNote: (note: Note) => void;
  onNewNote: () => void;
}

interface InlineDraftPayload {
  noteId: string;
  title: string;
  body: string;
}

export function NoteSplitView({
  notes,
  categories,
  activeNoteId,
  onSelectNote,
  onNewNote,
}: NoteSplitViewProps) {
  const { togglePin, deleteNote, updateNote, edition } = useNotesData();
  const selectedNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  const [isEditingInline, setIsEditingInline] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [copied, setCopied] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedPayloadRef = useRef<string>("");

  const debounceDelayMs = (edition as string) === "cloud" ? 800 : 250;

  // Initialize Coalescing Save Queue once via useState
  const [saveQueue] = useState(() => new CoalescingSaveQueue<InlineDraftPayload>());

  // Wire up save queue callbacks in effect
  useEffect(() => {
    saveQueue.setOnStatusChange((status) => {
      setSaveStatus(status);
    });

    saveQueue.setSaveFn(async (payload) => {
      await updateNote(payload.noteId, {
        title: payload.title.trim() || "Untitled Note",
        body: payload.body,
      });
    });
  }, [saveQueue, updateNote]);

  useEffect(() => {
    if (selectedNote) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync editor draft on note selection
      setDraftTitle(selectedNote.title);
      setDraftBody(selectedNote.body);
      setSaveStatus("saved");
      lastSavedPayloadRef.current = JSON.stringify({
        noteId: selectedNote.id,
        title: selectedNote.title,
        body: selectedNote.body,
      });
    }
  }, [selectedNote]);

  const flushSave = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (!selectedNote) return;
    const payload: InlineDraftPayload = {
      noteId: selectedNote.id,
      title: draftTitle,
      body: draftBody,
    };
    const payloadKey = JSON.stringify(payload);
    if (lastSavedPayloadRef.current === payloadKey && saveStatus !== "failed") {
      return;
    }
    lastSavedPayloadRef.current = payloadKey;
    await saveQueue.enqueue(payload);
    await saveQueue.flush();
  };

  const triggerDebouncedSave = (newTitle: string, newBody: string) => {
    if (!selectedNote) return;
    const payload: InlineDraftPayload = {
      noteId: selectedNote.id,
      title: newTitle,
      body: newBody,
    };
    const payloadKey = JSON.stringify(payload);
    if (lastSavedPayloadRef.current === payloadKey) return;

    setSaveStatus("saving");
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      lastSavedPayloadRef.current = payloadKey;
      saveQueue.enqueue(payload).catch((err) => {
        console.error("SplitView autosave error:", err);
      });
    }, debounceDelayMs);
  };

  const handleBodyChange = (newBody: string) => {
    setDraftBody(newBody);
    triggerDebouncedSave(draftTitle, newBody);
  };

  const handleTitleChange = (newTitle: string) => {
    setDraftTitle(newTitle);
    triggerDebouncedSave(newTitle, draftBody);
  };

  const handleRetry = async () => {
    try {
      await saveQueue.retry();
    } catch (err) {
      console.error("Retry failed:", err);
    }
  };

  // Warn on browser navigation while dirty, failed or pending
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isDirty = saveQueue.isDirty() || saveStatus === "saving" || saveStatus === "failed";
      if (isDirty) {
        flushSave().catch(console.error);
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  });

  const handleCopy = () => {
    if (!selectedNote) return;
    navigator.clipboard.writeText(`# ${selectedNote.title}\n\n${selectedNote.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote(id);
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  const applyFormatting = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = draftBody.substring(start, end);
    const textToInsert = selectedText ? `${prefix}${selectedText}${suffix}` : `${prefix}${suffix}`;
    const newBody = draftBody.substring(0, start) + textToInsert + draftBody.substring(end);
    handleBodyChange(newBody);
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + textToInsert.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

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

  const categoryObj = selectedNote
    ? categories.find((c) => c.name.toLowerCase() === selectedNote.tag.toLowerCase())
    : undefined;
  const categoryColor = categoryObj?.color || "var(--accent)";
  const contentType: NoteContentType = selectedNote?.contentType || "note";
  const Icon = TYPE_ICONS[contentType] || StickyNote;
  const words = selectedNote?.body ? selectedNote.body.trim().split(/\s+/).filter(Boolean).length : 0;
  const readTimeMin = Math.max(1, Math.ceil(words / 200));

  return (
    <div className="flex flex-col lg:flex-row gap-0 sm:gap-4 h-[calc(100vh-210px)] min-h-[520px] overflow-hidden rounded-2xl border border-border/80 bg-surface-1/60 backdrop-blur-md">
      {/* Left Column: Note Feed List (Title-Only) */}
      <div className="w-full lg:w-80 lg:min-w-[320px] max-h-40 sm:max-h-56 lg:max-h-none flex flex-col border-b lg:border-b-0 lg:border-r border-border/60 bg-surface-1/80 overflow-hidden shrink-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-surface-2/30">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted">
            All Items ({notes.length})
          </span>
          <button
            onClick={onNewNote}
            className="text-xs font-semibold text-accent hover:underline"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-2 space-y-1 scrollbar-thin">
          {notes.map((note) => {
            const isSelected = selectedNote?.id === note.id;
            const itemCat = categories.find((c) => c.name.toLowerCase() === note.tag.toLowerCase());
            const itemColor = itemCat?.color || "var(--accent)";

            return (
              <button
                key={note.id}
                onClick={async () => {
                  if (isEditingInline) {
                    await flushSave();
                  }
                  onSelectNote(note);
                  setIsEditingInline(false);
                }}
                className={cn(
                  "w-full rounded-xl p-3 text-left transition-all duration-150 relative group",
                  isSelected
                    ? "bg-accent/10 border border-accent/40 shadow-xs"
                    : "hover:bg-surface-2/60 border border-transparent",
                )}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5"
                    style={{
                      background: `color-mix(in oklab, ${itemColor} 15%, transparent)`,
                      color: itemColor,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: itemColor }}
                    />
                    {note.tag}
                  </span>

                  {note.section && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold rounded-full px-1.5 py-0.5 border border-border/80 bg-surface-2 text-accent truncate max-w-[80px]">
                      {note.section}
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    {note.pinned && <Pin className="h-3 w-3 text-accent fill-current rotate-45" />}
                    <span className="text-[10px] text-faint">{relTime(note.updatedAt)}</span>
                  </div>
                </div>

                {/* Title Only - No Excerpt */}
                <h4
                  dir={isRtlText(note.title) ? "rtl" : "ltr"}
                  className={cn(
                    "text-xs sm:text-[13px] font-bold line-clamp-2 text-text",
                    isSelected && "text-accent",
                  )}
                >
                  {note.title}
                </h4>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Active Document Canvas */}
      <div className="flex-1 flex flex-col bg-surface-1/40 overflow-hidden">
        {selectedNote ? (
          <>
            <div className="flex items-center justify-between border-b border-border/60 bg-surface-1/90 px-4 py-2.5 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    background: `color-mix(in oklab, ${categoryColor} 16%, transparent)`,
                    color: categoryColor,
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: categoryColor }}
                  />
                  {selectedNote.tag}
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
                  <Icon className="h-3.5 w-3.5" />
                  {TYPE_LABELS[contentType]}
                </span>

                {selectedNote.section && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-surface-2 px-2.5 py-1 text-xs font-medium text-accent">
                    <span className="text-[10px] text-faint font-semibold">§</span>
                    <span>{selectedNote.section}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {isEditingInline && (
                  <span className="text-[11px] font-medium mr-1">
                    {saveStatus === "saving" ? (
                      <span className="inline-flex items-center gap-1 text-accent animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                      </span>
                    ) : saveStatus === "failed" ? (
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="inline-flex items-center gap-1 text-rose-400 font-medium hover:underline cursor-pointer"
                        title="Save failed. Click to retry."
                      >
                        <AlertCircle className="h-3 w-3" /> Save failed · Retry
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-success">
                        <Check className="h-3 w-3" /> Saved
                      </span>
                    )}
                  </span>
                )}

                <div className="flex items-center rounded-lg bg-surface-2 p-0.5 text-xs font-medium">
                  <button
                    onClick={async () => {
                      if (isEditingInline) {
                        await flushSave();
                      }
                      setIsEditingInline(false);
                    }}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2.5 py-1 transition-all",
                      !isEditingInline
                        ? "bg-surface-1 text-accent shadow-xs"
                        : "text-faint hover:text-muted",
                    )}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Read</span>
                  </button>
                  <button
                    onClick={() => setIsEditingInline(true)}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2.5 py-1 transition-all",
                      isEditingInline
                        ? "bg-surface-1 text-accent shadow-xs"
                        : "text-faint hover:text-muted",
                    )}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                </div>

                <button
                  onClick={handleCopy}
                  title="Copy markdown"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface-2 text-muted hover:text-text transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>

                <button
                  onClick={() => togglePin(selectedNote.id)}
                  title={selectedNote.pinned ? "Unpin note" : "Pin note"}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface-2 transition-colors",
                    selectedNote.pinned ? "text-accent border-accent/40" : "text-muted hover:text-text",
                  )}
                >
                  <Pin className={cn("h-3.5 w-3.5", selectedNote.pinned && "fill-current")} style={{ rotate: "45deg" }} />
                </button>

                <button
                  onClick={() => handleDelete(selectedNote.id)}
                  title="Delete note"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface-2 text-faint hover:bg-danger/10 hover:text-danger hover:border-danger/30 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-thin">
              <div className="mx-auto max-w-2xl space-y-4">
                {isEditingInline ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      dir="auto"
                      value={draftTitle}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      onBlur={flushSave}
                      placeholder="Note Title..."
                      className="w-full rounded-xl bg-transparent font-display text-xl sm:text-2xl font-bold text-text focus:outline-none focus:bg-surface-2/40 px-2 py-1 transition-colors"
                    />

                    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-surface-2/60 p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => applyFormatting("## ", "")}
                        title="Heading 2"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface-hover hover:text-text"
                      >
                        <Heading2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting("### ", "")}
                        title="Heading 3"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface-hover hover:text-text"
                      >
                        <Heading3 className="h-3.5 w-3.5" />
                      </button>
                      <div className="h-3 w-px bg-border/80 mx-0.5" />
                      <button
                        type="button"
                        onClick={() => applyFormatting("**", "**")}
                        title="Bold"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface-hover hover:text-text"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting("*", "*")}
                        title="Italic"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface-hover hover:text-text"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <div className="h-3 w-px bg-border/80 mx-0.5" />
                      <button
                        type="button"
                        onClick={() => applyFormatting("- ", "")}
                        title="List"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface-hover hover:text-text"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting("- [ ] ", "")}
                        title="Task"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface-hover hover:text-text"
                      >
                        <CheckSquare className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      dir="auto"
                      rows={14}
                      value={draftBody}
                      onChange={(e) => handleBodyChange(e.target.value)}
                      onBlur={flushSave}
                      placeholder="Write your markdown insights and thoughts here..."
                      className="w-full resize-y rounded-xl border border-border/70 bg-surface-1/90 p-4 font-mono text-xs sm:text-sm leading-relaxed text-text focus:border-accent focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <header className="space-y-2 border-b border-border/60 pb-4">
                      <h1
                        dir={isRtlText(selectedNote.title) ? "rtl" : "ltr"}
                        className="font-display text-2xl sm:text-3xl font-bold text-text leading-tight"
                      >
                        {selectedNote.title}
                      </h1>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                        <div className="flex items-center gap-3">
                          {selectedNote.author && (
                            <span className="inline-flex items-center gap-1 text-accent font-medium">
                              <User className="h-3.5 w-3.5" /> By {selectedNote.author}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-faint">
                            <Calendar className="h-3.5 w-3.5" /> {relTime(selectedNote.updatedAt)}
                          </span>
                          {words > 0 && (
                            <span className="text-faint">
                              · {words} words ({readTimeMin} min read)
                            </span>
                          )}
                        </div>

                        {selectedNote.sourceUrl && (
                          <a
                            href={selectedNote.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-accent hover:underline bg-accent/10 px-2.5 py-0.5 rounded-full"
                          >
                            Source <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </header>

                    <article className="min-h-[220px] pt-1">
                      {selectedNote.body ? (
                        <MarkdownRenderer content={selectedNote.body} />
                      ) : (
                        <p className="italic text-xs text-faint py-8 text-center">
                          This note is empty. Click <strong>Edit</strong> above to add insights.
                        </p>
                      )}
                    </article>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-faint text-sm">
            Select a note on the left to read or edit.
          </div>
        )}
      </div>
    </div>
  );
}
