"use client";

import { useEffect, useRef, useState } from "react";
import { Modal, Field, FormFooter, Segmented, inputCls } from "@/components/ui/Modal";
import {
  useNotesData,
  CoalescingSaveQueue,
  registerPendingSaveHandler,
  type Note,
  type NoteContentType,
  type SaveStatus,
} from "@/lib/data/domains/notes";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
  BookOpen,
  Headphones,
  Lightbulb,
  Link2,
  StickyNote,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  CheckSquare,
  Quote,
  Code,
  Eye,
  Edit3,
  Check,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import { CategoryForm } from "./CategoryForm";
import { ImageInsertModal } from "./ImageInsertModal";
import { compressImage, formatImageMarkdown } from "@/lib/images";
import { cn } from "@/lib/utils";

const CONTENT_TYPES: { value: NoteContentType; label: string; icon: typeof StickyNote }[] = [
  { value: "note", label: "Note", icon: StickyNote },
  { value: "read", label: "Read", icon: BookOpen },
  { value: "listen", label: "Listen", icon: Headphones },
  { value: "idea", label: "Idea", icon: Lightbulb },
];

const NEW_NOTE_SESSION_KEY = "note:new";

export const getNoteEditorSessionKey = (open: boolean, noteId?: string): string | null =>
  open ? (noteId ? `note:${noteId}` : NEW_NOTE_SESSION_KEY) : null;

export const shouldInitializeNoteEditor = (
  initializedSessionKey: string | null,
  currentSessionKey: string | null,
): boolean => currentSessionKey !== null && initializedSessionKey !== currentSessionKey;

export const getDefaultNoteCategoryName = (
  categories: readonly { name: string }[],
): string => categories[0]?.name || "Personal";

interface NotePayload {
  activeId: string | null;
  title: string;
  body: string;
  tag: string;
  contentType: NoteContentType;
  sourceUrl: string;
  author: string;
}

export function NoteForm({
  open,
  onClose,
  note,
}: {
  open: boolean;
  onClose: () => void;
  note?: Note;
}) {
  const { categories, addNote, updateNote, deleteNote, edition } = useNotesData();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [contentType, setContentType] = useState<NoteContentType>("note");
  const [sourceUrl, setSourceUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [insertImageModalOpen, setInsertImageModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  // Auto-save state tracking: 'saved' | 'saving' | 'failed'
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const activeNoteIdRef = useRef<string | null>(null);
  const initializedSessionKeyRef = useRef<string | null>(null);
  const isInitialRenderRef = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorSessionKey = getNoteEditorSessionKey(open, note?.id);
  const defaultCategoryName = getDefaultNoteCategoryName(categories);
  const lastSavedPayloadRef = useRef<string>("");
  const initialType: NoteContentType = "note";

  // Debounce timing: ~250ms for local, ~800ms for cloud
  const debounceDelayMs = 250;

  // Initialize Coalescing Save Queue once via useState
  const [saveQueue] = useState(() => new CoalescingSaveQueue<NotePayload>());

  // Wire up save queue callbacks in effect
  useEffect(() => {
    saveQueue.setOnStatusChange((status) => {
      setSaveStatus(status);
    });

    saveQueue.setSaveFn(async (payload) => {
      const trimmedTitle = payload.title.trim();
      const trimmedBody = payload.body.trim();

      // Don't save completely empty new notes
      if (!payload.activeId && !trimmedTitle && !trimmedBody) {
        return;
      }

      const autoTitle =
        trimmedTitle || (trimmedBody ? trimmedBody.split(/[.\n]/)[0].slice(0, 48) : "Untitled Note");
      const inputPayload = {
        title: autoTitle,
        body: payload.body,
        tag: payload.tag || defaultCategoryName,
        contentType: payload.contentType,
        sourceUrl: payload.sourceUrl.trim(),
        author: payload.author.trim(),
      };

      if (payload.activeId) {
        await updateNote(payload.activeId, inputPayload);
        lastSavedPayloadRef.current = JSON.stringify({
          activeId: payload.activeId,
          title: payload.title,
          body: payload.body,
          tag: payload.tag,
          contentType: payload.contentType,
          sourceUrl: payload.sourceUrl,
          author: payload.author,
        });
      } else {
        const created = await addNote(inputPayload);
        activeNoteIdRef.current = created.id;
        setActiveNoteId(created.id);
        lastSavedPayloadRef.current = JSON.stringify({
          activeId: created.id,
          title: payload.title,
          body: payload.body,
          tag: payload.tag,
          contentType: payload.contentType,
          sourceUrl: payload.sourceUrl,
          author: payload.author,
        });
      }
    });
  }, [saveQueue, updateNote, addNote, defaultCategoryName]);

  // Initialize once per open editor session
  useEffect(() => {
    if (!editorSessionKey) {
      initializedSessionKeyRef.current = null;
      return;
    }
    if (!shouldInitializeNoteEditor(initializedSessionKeyRef.current, editorSessionKey)) return;
    initializedSessionKeyRef.current = editorSessionKey;

    if (note) {
      activeNoteIdRef.current = note.id;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync form state on session change
      setActiveNoteId(note.id);
      setTitle(note.title);
      setBody(note.body);
      setTag(note.tag);
      setContentType(note.contentType || "note");
      setSourceUrl(note.sourceUrl || "");
      setAuthor(note.author || "");
      lastSavedPayloadRef.current = JSON.stringify({
        activeId: note.id,
        title: note.title,
        body: note.body,
        tag: note.tag,
        contentType: note.contentType || "note",
        sourceUrl: (note.sourceUrl || "").trim(),
        author: (note.author || "").trim(),
      });
    } else {
      activeNoteIdRef.current = null;
      setActiveNoteId(null);
      setTitle("");
      setBody("");
      setTag(defaultCategoryName);
      setContentType(initialType);
      setSourceUrl("");
      setAuthor("");
      lastSavedPayloadRef.current = "";
    }
    setActiveTab("write");
    setSaveStatus("saved");
    isInitialRenderRef.current = true;
  }, [editorSessionKey, note, defaultCategoryName, initialType]);

  const flushSave = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const payload: NotePayload = {
      activeId: activeNoteIdRef.current,
      title,
      body,
      tag: tag || defaultCategoryName,
      contentType,
      sourceUrl,
      author,
    };
    const payloadKey = JSON.stringify(payload);
    if (lastSavedPayloadRef.current === payloadKey && saveStatus !== "failed") {
      return;
    }
    lastSavedPayloadRef.current = payloadKey;
    await saveQueue.enqueue(payload);
    await saveQueue.flush();
  };

  // Debounced auto-save on change
  useEffect(() => {
    if (!open) return;

    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      return;
    }

    const payload: NotePayload = {
      activeId: activeNoteIdRef.current,
      title,
      body,
      tag: tag || defaultCategoryName,
      contentType,
      sourceUrl,
      author,
    };
    const payloadKey = JSON.stringify(payload);

    if (lastSavedPayloadRef.current === payloadKey) {
      return;
    }

    setSaveStatus("saving");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      lastSavedPayloadRef.current = payloadKey;
      saveQueue.enqueue(payload).catch((err) => {
        console.error("Autosave enqueue error:", err);
      });
    }, debounceDelayMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [title, body, tag, contentType, sourceUrl, author, defaultCategoryName, debounceDelayMs, open, saveQueue]);

  // Register with global pending save coordinator for safe PWA updates / lifecycle
  useEffect(() => {
    if (!open) return;
    const unregister = registerPendingSaveHandler({
      isDirty: () => saveQueue.isDirty() || saveStatus === "saving" || saveStatus === "failed",
      flush: async () => {
        try {
          await flushSave();
          return saveStatus !== "failed" && !saveQueue.isDirty();
        } catch {
          return false;
        }
      },
    });
    return unregister;
  });

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

  const handleClose = async () => {
    try {
      await flushSave();
    } catch {
      // Best-effort flush on close
    }
    onClose();
  };

  const handleRetry = async () => {
    try {
      await saveQueue.retry();
    } catch (err) {
      console.error("Retry failed:", err);
    }
  };

  const insertSnippetAtCursor = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBody((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.substring(0, start) + snippet + body.substring(end);
    setBody(newBody);

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + snippet.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const compressed = await compressImage(file);
            const snippet = formatImageMarkdown(compressed, { align: "center", size: "full" });
            insertSnippetAtCursor(`\n\n${snippet}\n\n`);
          } catch (err) {
            console.error("Failed to paste image:", err);
          }
          break;
        }
      }
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        try {
          const compressed = await compressImage(file);
          const snippet = formatImageMarkdown(compressed, { align: "center", size: "full" });
          insertSnippetAtCursor(`\n\n${snippet}\n\n`);
        } catch (err) {
          console.error("Failed to drop image:", err);
        }
        break;
      }
    }
  };

  const applyFormatting = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    const textToInsert = selectedText ? `${prefix}${selectedText}${suffix}` : `${prefix}${suffix}`;

    const newBody = body.substring(0, start) + textToInsert + body.substring(end);
    setBody(newBody);

    requestAnimationFrame(() => {
      textarea.focus();
      const newCursorPos = selectedText
        ? start + textToInsert.length
        : start + prefix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  };

  const modalTitleNode = (
    <div className="flex items-center justify-between gap-3 pr-6">
      <span>{note || activeNoteId ? "Edit Note" : "New Note"}</span>
      <div className="flex items-center gap-1.5 text-xs font-normal">
        {saveStatus === "saving" ? (
          <span className="inline-flex items-center gap-1 text-accent font-medium animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving...
          </span>
        ) : saveStatus === "failed" ? (
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1 text-rose-400 font-medium hover:underline cursor-pointer"
            title="Save failed. Click to retry."
          >
            <AlertCircle className="h-3.5 w-3.5" /> Save failed · Retry
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-success font-medium">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Modal open={open} onClose={handleClose} title={modalTitleNode as unknown as string} wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleClose();
          }}
          className="space-y-4"
        >
          <Field label="Title">
            <input
              autoFocus
              dir="auto"
              className={`${inputCls} font-display text-base font-semibold`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={flushSave}
              placeholder="Title of note, article, or podcast episode..."
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Page / Category">
              <div className="flex items-center gap-2">
                <select
                  className={`${inputCls} cursor-pointer`}
                  value={tag}
                  onChange={(e) => {
                    if (e.target.value === "__NEW__") {
                      setCreatingCat(true);
                    } else {
                      setTag(e.target.value);
                    }
                  }}
                  onBlur={flushSave}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__NEW__">+ New custom page...</option>
                </select>
              </div>
            </Field>

            <Field label="Type">
              <Segmented
                value={contentType}
                onChange={(val) => {
                  setContentType(val);
                  setTimeout(flushSave, 0);
                }}
                options={CONTENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </Field>
          </div>

          {(contentType === "read" || contentType === "listen") && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Source Link (URL)">
                <div className="relative">
                  <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-faint" />
                  <input
                    className={`${inputCls} pl-9`}
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    onBlur={flushSave}
                    placeholder="https://article.com or podcast link"
                  />
                </div>
              </Field>
              <Field label="Author / Host / Channel">
                <input
                  className={inputCls}
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  onBlur={flushSave}
                  placeholder="e.g. Paul Graham, Lex Fridman..."
                />
              </Field>
            </div>
          )}

          {/* Content Field with Formatting Toolbar & Write/Preview Tabs */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                Content / Markdown Insights
              </label>

              {/* Write vs Preview Toggle */}
              <div className="flex items-center rounded-lg bg-surface-2 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab("write")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 transition-all",
                    activeTab === "write" ? "bg-surface-1 text-accent shadow-sm" : "text-faint hover:text-muted",
                  )}
                >
                  <Edit3 className="h-3 w-3" />
                  <span>Write</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 transition-all",
                    activeTab === "preview" ? "bg-surface-1 text-accent shadow-sm" : "text-faint hover:text-muted",
                  )}
                >
                  <Eye className="h-3 w-3" />
                  <span>Preview</span>
                </button>
              </div>
            </div>

            {activeTab === "write" ? (
              <div className="space-y-2">
                {/* Formatting Toolbar */}
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface-2/60 p-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => applyFormatting("# ", "")}
                    title="Heading 1 (#)"
                    className="flex h-7 w-7 items-center justify-center rounded-md font-bold text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <Heading1 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting("## ", "")}
                    title="Heading 2 (##)"
                    className="flex h-7 w-7 items-center justify-center rounded-md font-semibold text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <Heading2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting("### ", "")}
                    title="Heading 3 (###)"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <Heading3 className="h-3.5 w-3.5" />
                  </button>

                  <div className="h-4 w-px bg-border/80 mx-0.5" />

                  <button
                    type="button"
                    onClick={() => applyFormatting("**", "**")}
                    title="Bold (**text**)"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting("*", "*")}
                    title="Italic (*text*)"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting("<u>", "</u>")}
                    title="Underline (<u>text</u>)"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <Underline className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting("~~", "~~")}
                    title="Strikethrough (~~text~~)"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <Strikethrough className="h-3.5 w-3.5" />
                  </button>

                  <div className="h-4 w-px bg-border/80 mx-0.5" />

                  <button
                    type="button"
                    onClick={() => applyFormatting("- ", "")}
                    title="Bulleted List (- item)"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting("- [ ] ", "")}
                    title="Task List (- [ ] item)"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting("> ", "")}
                    title="Blockquote (> quote)"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <Quote className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting("```\n", "\n```")}
                    title="Code Block (``` code ```)"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text"
                  >
                    <Code className="h-3.5 w-3.5" />
                  </button>

                  <div className="h-4 w-px bg-border/80 mx-0.5" />

                  <button
                    type="button"
                    onClick={() => setInsertImageModalOpen(true)}
                    title="Insert Photo / Image"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-accent transition-colors"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  dir="auto"
                  rows={9}
                  className={`${inputCls} resize-y font-mono text-xs sm:text-sm leading-relaxed text-left rtl:text-right`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onBlur={flushSave}
                  placeholder="Write thoughts, markdown (# headers, **bold**, - lists) or summaries freely..."
                />
              </div>
            ) : (
              <div className="min-h-[200px] max-h-[40vh] overflow-y-auto rounded-xl border border-border/80 bg-surface-1 p-4">
                {body ? (
                  <MarkdownRenderer content={body} />
                ) : (
                  <p className="italic text-xs text-faint">Nothing written to preview yet.</p>
                )}
              </div>
            )}
          </div>

          <FormFooter
            submitLabel="Done"
            disabled={false}
            onDelete={
              activeNoteId
                ? async () => {
                    try {
                      await deleteNote(activeNoteId);
                      onClose();
                    } catch (err) {
                      console.error("Failed to delete note:", err);
                    }
                  }
                : undefined
            }
          />
        </form>
      </Modal>

      <CategoryForm
        open={creatingCat}
        onClose={() => setCreatingCat(false)}
      />

      <ImageInsertModal
        open={insertImageModalOpen}
        onClose={() => setInsertImageModalOpen(false)}
        onInsert={(md) => insertSnippetAtCursor(`\n\n${md}\n\n`)}
      />
    </>
  );
}
