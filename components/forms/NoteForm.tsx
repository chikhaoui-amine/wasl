"use client";

import { useEffect, useRef, useState } from "react";
import {
  useNotesData,
  CoalescingSaveQueue,
  registerPendingSaveHandler,
  type Note,
  type NoteContentType,
  type SaveStatus,
} from "@/lib/data/domains/notes";
import { MarkdownRenderer, isRtlText } from "@/components/ui/MarkdownRenderer";
import { AttachedPhotosBar } from "@/components/notes/AttachedPhotosBar";
import {
  ArrowLeft,
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
  Check,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  Trash2,
  User,
  FileCode,
  Download,
  Upload,
} from "lucide-react";
import { exportNoteAsMarkdown } from "@/lib/notes-export";
import { parseMarkdownNote } from "@/lib/notes-import";
import { CategoryForm } from "./CategoryForm";
import { ImageInsertModal } from "./ImageInsertModal";
import {
  compressImage,
  formatImageReference,
  parseNoteMarkdown,
  composeNoteMarkdown,
  type ImageAlignment,
  type ImageSize,
} from "@/lib/images";
import { cn } from "@/lib/utils";

export interface NoteFormData {
  categories: readonly { id?: string; name: string; color?: string }[];
  addNote: (input: { title: string; body: string; tag: string; pinned?: boolean; contentType?: NoteContentType; sourceUrl?: string; author?: string }) => Promise<Note>;
  updateNote: (id: string, patch: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  edition?: string;
}

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
  data,
}: {
  open: boolean;
  onClose: () => void;
  note?: Note;
  data?: NoteFormData;
}) {
  const notesData = useNotesData();
  const { categories, addNote, updateNote, deleteNote, edition } = data ?? notesData;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageReferences, setImageReferences] = useState<Record<string, string>>({});
  const [tag, setTag] = useState("");
  const [contentType, setContentType] = useState<NoteContentType>("note");
  const [sourceUrl, setSourceUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [insertImageModalOpen, setInsertImageModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"source" | "preview">("source");

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
  const debounceDelayMs = (edition as string) === "cloud" ? 800 : 250;

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

      const parsed = parseNoteMarkdown(note.body);
      setBody(parsed.cleanBody);
      setImageReferences(parsed.references);

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
      setImageReferences({});
      setTag(defaultCategoryName);
      setContentType(initialType);
      setSourceUrl("");
      setAuthor("");
      lastSavedPayloadRef.current = "";
    }
    setActiveTab("source");
    setSaveStatus("saved");
    isInitialRenderRef.current = true;
  }, [editorSessionKey, note, defaultCategoryName, initialType]);

  const getFullComposedBody = () => composeNoteMarkdown(body, imageReferences);

  const flushSave = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const fullBody = getFullComposedBody();
    const payload: NotePayload = {
      activeId: activeNoteIdRef.current,
      title,
      body: fullBody,
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

  const handleDelete = async () => {
    const targetId = activeNoteIdRef.current || activeNoteId;
    if (!targetId) {
      onClose();
      return;
    }
    try {
      await deleteNote(targetId);
      onClose();
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  const mdFileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadMarkdown = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseMarkdownNote(text, file.name, tag || defaultCategoryName);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.body) setBody(parsed.body);
      if (parsed.tag) setTag(parsed.tag);
      if (parsed.author) setAuthor(parsed.author);
      if (parsed.sourceUrl) setSourceUrl(parsed.sourceUrl);
      if (parsed.contentType) setContentType(parsed.contentType);
    } catch (err) {
      console.error("Failed to read markdown file:", err);
    } finally {
      if (mdFileInputRef.current) mdFileInputRef.current.value = "";
    }
  };

  const handleExportMarkdown = () => {
    exportNoteAsMarkdown({
      id: activeNoteIdRef.current || "draft",
      title: title || "Untitled Note",
      body: getFullComposedBody(),
      tag: tag || defaultCategoryName,
      author,
      sourceUrl,
      contentType,
      pinned: note?.pinned ?? false,
      updatedAt: Date.now(),
    });
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !creatingCat && !insertImageModalOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Debounced auto-save on change
  useEffect(() => {
    if (!open) return;

    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      return;
    }

    const fullBody = composeNoteMarkdown(body, imageReferences);
    const payload: NotePayload = {
      activeId: activeNoteIdRef.current,
      title,
      body: fullBody,
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
  }, [title, body, imageReferences, tag, contentType, sourceUrl, author, defaultCategoryName, debounceDelayMs, open, saveQueue]);

  // Register with global pending save coordinator for safe lifecycle
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

  if (!open) return null;

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

  const getNextImageKey = () => {
    let maxId = 0;
    for (const key of Object.keys(imageReferences)) {
      const match = key.match(/^img-(\d+)$/);
      if (match) {
        const id = parseInt(match[1], 10);
        if (id > maxId) maxId = id;
      }
    }
    return `img-${maxId + 1}`;
  };

  const handleInsertImageReference = (
    dataUri: string,
    options: { caption?: string; align?: ImageAlignment | string; size?: ImageSize | string } = {},
  ) => {
    const refKey = getNextImageKey();
    setImageReferences((prev) => ({ ...prev, [refKey]: dataUri }));
    const snippet = formatImageReference(refKey, options);
    insertSnippetAtCursor(`\n\n${snippet}\n\n`);
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
            handleInsertImageReference(compressed, { align: "center", size: "full" });
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
          handleInsertImageReference(compressed, { align: "center", size: "full" });
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

  const handleRemoveImageRef = (refKey: string) => {
    setImageReferences((prev) => {
      const next = { ...prev };
      delete next[refKey];
      return next;
    });
    // Remove any reference tags from body
    const regex = new RegExp(`!\\[[^\\]]*\\]\\[${refKey}\\]\\n?`, "g");
    setBody((prev) => prev.replace(regex, ""));
  };

  const activeCategory = categories.find((c) => c.name.toLowerCase() === (tag || defaultCategoryName).toLowerCase());
  const activeCategoryColor = activeCategory?.color || "var(--accent)";

  const words = body ? body.trim().split(/\s+/).filter(Boolean).length : 0;
  const readTimeMin = Math.max(1, Math.ceil(words / 200));

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-bg/95 backdrop-blur-xl animate-in fade-in duration-200">
        {/* Sticky Top Control Header */}
        <div className="sticky top-0 z-20 border-b border-border/60 bg-bg/85 backdrop-blur-md px-3 py-2 sm:px-8">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 flex-wrap min-w-0">
            {/* Left: Back & Category & Type */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap min-w-0">
              <button
                type="button"
                onClick={handleClose}
                aria-label="Back to Notes"
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 py-1.5 sm:px-3 text-xs font-semibold text-text transition-colors hover:bg-surface-2 hover:border-accent shrink-0"
              >
                <ArrowLeft className="h-4 w-4 text-accent" />
                <span className="hidden sm:inline">Back to Notes</span>
              </button>

              {/* Category Pill Dropdown */}
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold max-w-[120px] xs:max-w-[160px] truncate shrink-0"
                style={{
                  background: `color-mix(in oklab, ${activeCategoryColor} 16%, transparent)`,
                  color: activeCategoryColor,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: activeCategoryColor }}
                />
                <select
                  value={tag || defaultCategoryName}
                  onChange={(e) => {
                    if (e.target.value === "__NEW__") {
                      setCreatingCat(true);
                    } else {
                      setTag(e.target.value);
                    }
                  }}
                  onBlur={flushSave}
                  className="bg-transparent font-semibold outline-none cursor-pointer border-none text-xs truncate"
                  style={{ color: activeCategoryColor }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} className="bg-surface-1 text-text">
                      {c.name}
                    </option>
                  ))}
                  <option value="__NEW__" className="bg-surface-1 text-text">+ New Page...</option>
                </select>
              </div>

              {/* Content Type Segmented Switcher */}
              <div className="flex items-center rounded-full bg-surface-2 p-0.5 text-xs shrink-0">
                {CONTENT_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = contentType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setContentType(t.value);
                        setTimeout(flushSave, 0);
                      }}
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all",
                        isSelected ? "bg-surface-1 text-accent shadow-xs" : "text-faint hover:text-muted",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="hidden md:inline">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Word count, Auto-save badge, View switcher, Delete, Done */}
            <div className="flex items-center gap-2">
              <span className="hidden lg:inline-block text-xs font-medium text-faint mr-1">
                {words} words · {readTimeMin} min read
              </span>

              {/* Save Status Badge */}
              <div className="flex items-center gap-1 text-xs mr-1">
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
                    <AlertCircle className="h-3.5 w-3.5" /> Retry
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-success font-medium">
                    <Check className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
              </div>

              {/* Hidden file input for uploading markdown file */}
              <input
                ref={mdFileInputRef}
                type="file"
                accept=".md,.markdown,.txt"
                onChange={handleUploadMarkdown}
                className="hidden"
              />

              {/* Import / Export Markdown Action Buttons */}
              <button
                type="button"
                onClick={() => mdFileInputRef.current?.click()}
                title="Import markdown file into editor"
                className="flex items-center gap-1 rounded-lg border border-border bg-surface-1 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Import .md</span>
              </button>

              <button
                type="button"
                onClick={handleExportMarkdown}
                title="Export current note as markdown"
                className="flex items-center gap-1 rounded-lg border border-border bg-surface-1 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>

              {/* View Mode Toggle: Source (Write) | Read (Preview) */}
              <div className="flex items-center rounded-lg bg-surface-2 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab("source")}
                  title="Source Markdown Editor"
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-1 transition-all",
                    activeTab === "source" ? "bg-surface-1 text-accent shadow-xs" : "text-faint hover:text-muted",
                  )}
                >
                  <FileCode className="h-3.5 w-3.5" />
                  <span>Source</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  title="Read / Rendered Preview Mode"
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-1 transition-all",
                    activeTab === "preview" ? "bg-surface-1 text-accent shadow-xs" : "text-faint hover:text-muted",
                  )}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Read</span>
                </button>
              </div>

              {/* Delete action */}
              {(activeNoteId || note) && (
                <button
                  type="button"
                  onClick={handleDelete}
                  title="Delete note"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-1 text-faint transition-colors hover:bg-danger/10 hover:text-danger hover:border-danger/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              {/* Done button */}
              <button
                type="button"
                onClick={handleClose}
                className="btn-hero flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Done</span>
              </button>
            </div>
          </div>

          {/* Quick Formatting Toolbar in Top Header */}
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-1 overflow-x-auto pt-2 pb-0.5 scrollbar-none text-xs">
            <div className="flex items-center gap-0.5">
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

              <div className="h-3.5 w-px bg-border/80 mx-1" />

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

              <div className="h-3.5 w-px bg-border/80 mx-1" />

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
                title="Code Block"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text"
              >
                <Code className="h-3.5 w-3.5" />
              </button>

              <div className="h-3.5 w-px bg-border/80 mx-1" />

              <button
                type="button"
                onClick={() => setInsertImageModalOpen(true)}
                title="Insert Photo / Image"
                className="flex items-center gap-1 px-2 h-7 rounded-md text-muted hover:bg-surface-hover hover:text-accent font-medium transition-colors"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="text-[11px]">Photo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Full-Page Document Canvas */}
        <main className="mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-12 space-y-6">
          {/* Large Document Title Input */}
          <header className="space-y-4 border-b border-border/60 pb-6">
            <input
              autoFocus={!title}
              dir={isRtlText(title) ? "rtl" : "ltr"}
              className={cn(
                "w-full font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-text leading-tight bg-transparent border-none outline-none placeholder:text-faint/40",
                isRtlText(title) ? "text-right" : "text-left",
              )}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={flushSave}
              placeholder="Title of note, article, or podcast..."
            />

            {/* Subfields for Author & Source Link */}
            {(contentType === "read" || contentType === "listen" || author || sourceUrl) && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-3 py-1 flex-1 min-w-[180px]">
                  <User className="h-3.5 w-3.5 text-accent shrink-0" />
                  <input
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    onBlur={flushSave}
                    placeholder="Author / Host / Channel"
                    className="w-full bg-transparent text-xs text-text outline-none placeholder:text-faint"
                  />
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 px-3 py-1 flex-1 min-w-[220px]">
                  <Link2 className="h-3.5 w-3.5 text-accent shrink-0" />
                  <input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    onBlur={flushSave}
                    placeholder="Source link (URL)"
                    className="w-full bg-transparent text-xs text-text outline-none placeholder:text-faint"
                  />
                </div>
              </div>
            )}
          </header>

          {/* Document Body Area */}
          <article className="min-h-[400px] space-y-6">
            {activeTab === "source" ? (
              <>
                <textarea
                  ref={textareaRef}
                  dir="auto"
                  rows={16}
                  className="w-full rounded-2xl border border-border/80 bg-surface-1 p-5 font-mono text-sm leading-relaxed text-text outline-none focus:border-accent resize-y min-h-[400px] shadow-inner"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onBlur={flushSave}
                  placeholder="Write thoughts, markdown (# headers, **bold**, - lists, ![Photo | left | medium][img-1]) freely..."
                />

                {/* Clean Attached Photos Manager */}
                <AttachedPhotosBar
                  references={imageReferences}
                  body={body}
                  onInsertRef={(refKey, snippet) => insertSnippetAtCursor(`\n\n${snippet}\n\n`)}
                  onRemoveRef={handleRemoveImageRef}
                  onAddPhotoClick={() => setInsertImageModalOpen(true)}
                />
              </>
            ) : (
              <div className="min-h-[400px] py-2">
                {body || Object.keys(imageReferences).length > 0 ? (
                  <MarkdownRenderer content={getFullComposedBody()} />
                ) : (
                  <p className="italic text-base text-faint text-center py-12">
                    Nothing written to preview yet.
                  </p>
                )}
              </div>
            )}
          </article>
        </main>
      </div>

      <CategoryForm
        open={creatingCat}
        onClose={() => setCreatingCat(false)}
      />

      <ImageInsertModal
        open={insertImageModalOpen}
        onClose={() => setInsertImageModalOpen(false)}
        onInsert={(dataUri, opts) => {
          handleInsertImageReference(dataUri, opts);
        }}
      />
    </>
  );
}
