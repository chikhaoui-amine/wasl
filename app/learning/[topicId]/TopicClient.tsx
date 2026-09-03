"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
  ListTodo,
  Pencil,
  Plus,
  StickyNote,
  X,
  Eye,
  Edit3,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List as ListIcon,
  CheckSquare,
  Quote,
  Code,
  Trash2,
  Copy,
  Calendar,
  Image as ImageIcon,
} from "lucide-react";
import { useTopicsData, topicProgress, type Topic, type TopicNote } from "@/lib/data/domains/topics";
import { relTime } from "@/lib/data/domains/notes";
import { Card, ProgressRing, SectionTitle } from "@/components/ui/primitives";
import { TopicForm } from "@/components/forms/TopicForm";
import { ImageInsertModal } from "@/components/forms/ImageInsertModal";
import { compressImage, formatImageMarkdown } from "@/lib/images";
import { Modal, Field, FormFooter, inputCls } from "@/components/ui/Modal";
import { MarkdownRenderer, isRtlText } from "@/components/ui/MarkdownRenderer";
import { Hydrate } from "@/lib/hydration";
import { DynamicIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { TopicNotes } from "@/components/learning/TopicNotes";

export default function TopicClient() {
  const params = useParams<{ topicId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { topics } = useTopicsData();
  const [editing, setEditing] = useState(false);

  const rawId = params?.topicId;
  const topicId = (rawId && rawId !== "default") ? rawId : (searchParams?.get("id") || rawId);
  const topic = topics.find((t) => t.id === topicId);

  return (
    <Hydrate>
      {!topic ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <p className="text-sm text-muted">This topic doesn&apos;t exist (anymore).</p>
          <Link href="/learning" className="text-[13px] font-medium text-accent hover:opacity-80">
            ← Back to Learning
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* header — topic-color gradient wash */}
          <div
            className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5"
            style={{
              backgroundImage: `linear-gradient(150deg, color-mix(in oklab, ${topic.color} 18%, transparent), transparent 55%)`,
            }}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <button
                onClick={() => router.push("/learning")}
                aria-label="Back to learning"
                className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-border text-muted transition-colors hover:bg-surface-hover hover:text-text"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span
                className="grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-[14px] sm:rounded-[16px]"
                style={{ background: `${topic.color}22` }}
              >
                <DynamicIcon name={topic.icon} className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: topic.color }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-text truncate">{topic.name}</h1>
                  <button
                    onClick={() => setEditing(true)}
                    aria-label="Edit topic"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-hover hover:text-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                {topic.description && <p className="mt-0.5 text-[13px] sm:text-[14px] text-muted line-clamp-2">{topic.description}</p>}
                <p className="mt-1 text-[11px] text-faint">last touched {relTime(topic.touchedAt)}</p>
              </div>
            </div>

            <div className="flex items-center justify-end sm:justify-center shrink-0 self-end sm:self-start">
              <ProgressRing value={topicProgress(topic)} size={56} color={topic.color}>
                <span className="tabular text-[11px] sm:text-[12px] font-semibold text-text">{topicProgress(topic)}%</span>
              </ProgressRing>
            </div>
          </div>

          {/* Roadmap */}
          <Card className="p-4 sm:p-5">
            <SectionTitle>
              <span className="flex items-center gap-1.5">
                <ListTodo className="h-3.5 w-3.5" /> Roadmap — what to learn
              </span>
            </SectionTitle>
            <RoadmapCheckList topic={topic} color={topic.color} />
          </Card>

          <TopicNotes topic={topic} />
        </div>
      )}

      {topic && <TopicForm open={editing} onClose={() => setEditing(false)} topic={topic} />}

    </Hydrate>
  );
}

/* ---------- Topic Note Card ---------- */

function TopicNoteCard({
  note,
  onRead,
  onEdit,
  onDelete,
}: {
  note: TopicNote;
  onRead: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="card card-hover flex h-28 sm:h-32 flex-col justify-between p-3.5 sm:p-4 transition-all group">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] sm:text-[11px] font-medium text-faint">{relTime(note.updatedAt || note.createdAt)}</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onEdit}
            title="Edit note"
            className="grid h-6 w-6 place-items-center rounded-md text-faint opacity-60 transition-all hover:bg-surface-2 hover:text-accent hover:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete note"
            className="grid h-6 w-6 place-items-center rounded-md text-faint opacity-60 transition-all hover:bg-surface-2 hover:text-danger hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <button
        onClick={onRead}
        className="flex flex-1 items-center w-full text-left group-hover:opacity-95 transition-opacity pt-0.5"
      >
        <h3
          dir={isRtlText(note.title || "") ? "rtl" : "ltr"}
          className={cn(
            "font-display text-xl sm:text-2xl font-bold leading-tight text-text group-hover:text-accent transition-colors line-clamp-2 tracking-tight",
            isRtlText(note.title || "") ? "text-right" : "text-left",
          )}
        >
          {note.title || (note.text ? note.text.slice(0, 60) : "Untitled Note")}
        </h3>
      </button>
    </article>
  );
}

/* ---------- Topic Note Form Modal ---------- */

const TOOLBAR_BUTTONS = [
  { icon: Bold, prefix: "**", suffix: "**", label: "Bold" },
  { icon: Italic, prefix: "*", suffix: "*", label: "Italic" },
  { icon: Heading1, prefix: "# ", suffix: "", label: "H1" },
  { icon: Heading2, prefix: "## ", suffix: "", label: "H2" },
  { icon: ListIcon, prefix: "- ", suffix: "", label: "List" },
  { icon: CheckSquare, prefix: "- [ ] ", suffix: "", label: "Checklist" },
  { icon: Quote, prefix: "> ", suffix: "", label: "Quote" },
  { icon: Code, prefix: "`", suffix: "`", label: "Code" },
] as const;

function TopicNoteFormModal(props: {
  open: boolean;
  onClose: () => void;
  topicId: string;
  note?: TopicNote;
}) {
  if (!props.open) return null;
  return <TopicNoteFormModalInner key={props.note?.id ?? "new"} {...props} />;
}

function TopicNoteFormModalInner({
  open,
  onClose,
  topicId,
  note,
}: {
  open: boolean;
  onClose: () => void;
  topicId: string;
  note?: TopicNote;
}) {
  const { addNote, updateNote, deleteNote } = useTopicsData();
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.text ?? "");
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [insertImageModalOpen, setInsertImageModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = useCallback((prefix: string, suffix = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end);
    const replacement = `${prefix}${selected}${suffix}`;
    const newBody = body.slice(0, start) + replacement + body.slice(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      ta.focus();
      const cursorPos = start + prefix.length + selected.length + suffix.length;
      ta.setSelectionRange(cursorPos, cursorPos);
    });
  }, [body]);

  const insertSnippetAtCursor = (snippet: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setBody((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newBody = body.slice(0, start) + snippet + body.slice(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + snippet.length;
      ta.setSelectionRange(newPos, newPos);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !body.trim()) return;
    if (note) {
      updateNote(topicId, note.id, title.trim(), body);
    } else {
      addNote(topicId, title.trim(), body);
    }
    onClose();
  };

  const handleDelete = () => {
    if (note) {
      deleteNote(topicId, note.id);
    }
    onClose();
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={note ? "Edit Note" : "New Note"} size="3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className={inputCls}
              autoFocus
            />
          </Field>

          <Field label="Content (Markdown)">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-0.5 flex-wrap">
                {TOOLBAR_BUTTONS.map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => insertMarkdown(btn.prefix, btn.suffix)}
                    title={btn.label}
                    className="grid h-7 w-7 place-items-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-text"
                  >
                    <btn.icon className="h-3.5 w-3.5" />
                  </button>
                ))}

                <div className="h-4 w-px bg-border/80 mx-1" />

                <button
                  type="button"
                  onClick={() => setInsertImageModalOpen(true)}
                  title="Insert Photo / Image"
                  className="grid h-7 w-7 place-items-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-accent"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("write")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                    activeTab === "write" ? "bg-surface text-text shadow-sm" : "text-faint hover:text-muted",
                  )}
                >
                  <Edit3 className="h-3 w-3" /> Write
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                    activeTab === "preview" ? "bg-surface text-text shadow-sm" : "text-faint hover:text-muted",
                  )}
                >
                  <Eye className="h-3 w-3" /> Preview
                </button>
              </div>
            </div>

            {activeTab === "write" ? (
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onPaste={handlePaste}
                onDrop={handleDrop}
                placeholder="Write your notes here... Supports **bold**, *italic*, # headings, - lists, > quotes, `code`, and more."
                rows={14}
                className={cn(inputCls, "resize-y font-mono text-[13px] leading-relaxed min-h-[200px]")}
              />
            ) : (
              <div className="rounded-[12px] border border-border bg-surface-2 px-4 py-3 min-h-[200px] max-h-[500px] overflow-y-auto">
                {body.trim() ? (
                  <MarkdownRenderer content={body} />
                ) : (
                  <p className="text-sm text-faint italic py-8 text-center">Nothing to preview yet.</p>
                )}
              </div>
            )}
          </Field>

          <FormFooter
            onDelete={note ? handleDelete : undefined}
            submitLabel={note ? "Save Changes" : "Add Note"}
            disabled={!title.trim() && !body.trim()}
          />
        </form>
      </Modal>

      <ImageInsertModal
        open={insertImageModalOpen}
        onClose={() => setInsertImageModalOpen(false)}
        onInsert={(md) => insertSnippetAtCursor(`\n\n${md}\n\n`)}
      />
    </>
  );
}

/* ---------- Topic Note Detail View ---------- */

function TopicNoteDetailView({
  note,
  topicColor,
  onClose,
  onEdit,
  onDelete,
}: {
  note: TopicNote;
  topicColor: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const words = note.text ? note.text.trim().split(/\s+/).length : 0;
  const readTimeMin = Math.max(1, Math.ceil(words / 200));

  const handleCopy = () => {
    navigator.clipboard.writeText(`# ${note.title}\n\n${note.text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg/95 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Sticky Top Control Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-bg/80 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-surface-2 hover:border-accent"
            >
              <ArrowLeft className="h-4 w-4 text-accent" />
              <span className="hidden sm:inline">Back</span>
            </button>
          </div>

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
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm transition-all hover:brightness-110 active:scale-95"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>

            <button
              onClick={onDelete}
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

      {/* Main Document Body */}
      <main className="mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-14 space-y-6">
        <header className="space-y-4 border-b border-border/60 pb-6">
          {note.title && (
            <h1
              dir={isRtlText(note.title) ? "rtl" : "ltr"}
              className={cn(
                "font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-text leading-tight",
                isRtlText(note.title) ? "text-right" : "text-left",
              )}
            >
              {note.title}
            </h1>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5 text-faint">
              <Calendar className="h-4 w-4" />
              Updated {relTime(note.updatedAt || note.createdAt)}
            </span>
          </div>
        </header>

        <article className="min-h-[300px] pt-2">
          {note.text ? (
            <MarkdownRenderer content={note.text} />
          ) : (
            <p className="italic text-base text-faint text-center py-12">
              This note is empty. Click <strong className="text-accent">Edit</strong> to add insights.
            </p>
          )}
        </article>
      </main>
    </div>
  );
}

/* ---------- pieces ---------- */

function RoadmapCheckList({
  topic,
  color,
}: {
  topic: Topic;
  color: string;
}) {
  const {
    addStep,
    updateStepTitle,
    toggleStep,
    toggleStepCollapsed,
    deleteStep,
    addSubstep,
    updateSubstepTitle,
    toggleSubstep,
    deleteSubstep,
  } = useTopicsData();
  const [draft, setDraft] = useState("");
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);

  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepTitle, setEditingStepTitle] = useState("");

  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubTitle, setEditingSubTitle] = useState("");

  const startEditingStep = (stepId: string, currentTitle: string) => {
    setEditingStepId(stepId);
    setEditingStepTitle(currentTitle);
  };

  const saveStepEdit = (stepId: string) => {
    if (editingStepTitle.trim()) {
      updateStepTitle(topic.id, stepId, editingStepTitle.trim());
    }
    setEditingStepId(null);
  };

  const startEditingSubstep = (subId: string, currentTitle: string) => {
    setEditingSubId(subId);
    setEditingSubTitle(currentTitle);
  };

  const saveSubstepEdit = (stepId: string, subId: string) => {
    if (editingSubTitle.trim()) {
      updateSubstepTitle(topic.id, stepId, subId, editingSubTitle.trim());
    }
    setEditingSubId(null);
  };

  const handleToggleAddSubstep = (stepId: string, currentlyCollapsed: boolean) => {
    if (currentlyCollapsed) {
      toggleStepCollapsed(topic.id, stepId);
    }
    setAddingSubFor(addingSubFor === stepId ? null : stepId);
  };

  const addBigStep = () => {
    if (!draft.trim()) return;
    addStep(topic.id, draft.trim());
    setDraft("");
  };

  const handleAddSubstep = (stepId: string) => {
    const text = (subDrafts[stepId] || "").trim();
    if (!text) return;
    addSubstep(topic.id, stepId, text);
    setSubDrafts((prev) => ({ ...prev, [stepId]: "" }));
  };

  return (
    <div className="space-y-3">
      {topic.roadmap.length === 0 && (
        <p className="pb-1 text-[12px] text-faint">
          Break the topic into steps — each one you tick moves the progress ring.
        </p>
      )}

      {topic.roadmap.map((s) => {
        const subs = s.substeps || [];
        const doneSubs = subs.filter((x) => x.done).length;
        const isCollapsed = s.collapsed ?? true;

        return (
          <div key={s.id} className="group/step space-y-2 rounded-[12px] border border-border bg-surface/40 p-3">
            {/* Big Step Row */}
            <div className="flex items-start gap-2.5 sm:gap-3">
              <button
                onClick={() => toggleStep(topic.id, s.id)}
                aria-label={s.done ? "Mark step open" : "Mark step done"}
                className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all",
                  s.done ? "border-transparent text-bg" : "border-border-strong text-transparent hover:border-accent",
                )}
                style={s.done ? { background: color } : undefined}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </button>

              {editingStepId === s.id ? (
                <input
                  value={editingStepTitle}
                  onChange={(e) => setEditingStepTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveStepEdit(s.id);
                    if (e.key === "Escape") setEditingStepId(null);
                  }}
                  onBlur={() => saveStepEdit(s.id)}
                  autoFocus
                  className="flex-1 rounded-md border border-accent bg-surface-2 px-2 py-0.5 text-sm font-medium text-text outline-none min-w-0"
                />
              ) : (
                <span
                  onClick={() => startEditingStep(s.id, s.title)}
                  className={cn(
                    "flex-1 text-sm font-medium leading-snug break-words min-w-0 pt-0.5 cursor-pointer hover:text-accent transition-colors group/title flex items-center gap-1.5",
                    s.done ? "text-faint line-through" : "text-text",
                  )}
                  title="Click to edit step title"
                >
                  <span className="flex-1 min-w-0">{s.title}</span>
                  <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover/title:opacity-60 transition-opacity" />
                </span>
              )}

              <div className="flex items-center gap-1 shrink-0">
                {subs.length > 0 && (
                  <button
                    onClick={() => toggleStepCollapsed(topic.id, s.id)}
                    aria-label={isCollapsed ? "Expand substeps" : "Collapse substeps"}
                    className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-text"
                  >
                    {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    <span className="tabular">{doneSubs}/{subs.length}</span>
                  </button>
                )}

                <button
                  onClick={() => handleToggleAddSubstep(s.id, isCollapsed)}
                  aria-label="Add substep"
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-faint transition-colors hover:bg-surface-2 hover:text-accent"
                >
                  <Plus className="h-3 w-3" /> <span className="hidden xs:inline">Substep</span>
                </button>

                <button
                  onClick={() => deleteStep(topic.id, s.id)}
                  aria-label="Delete step"
                  className="grid h-6 w-6 place-items-center rounded-md text-faint transition-opacity hover:bg-surface-2 hover:text-danger opacity-70 sm:opacity-0 sm:group-hover/step:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Nested Substeps List */}
            {(!isCollapsed && subs.length > 0 || addingSubFor === s.id) && (
              <div className="ml-3.5 border-l-2 border-border/80 pl-3 space-y-1.5 pt-1">
                {!isCollapsed && subs.map((sub) => (
                  <div key={sub.id} className="group/sub flex items-start gap-2.5 rounded-lg px-2 py-1 hover:bg-surface-2/60">
                    <button
                      onClick={() => toggleSubstep(topic.id, s.id, sub.id)}
                      aria-label={sub.done ? "Mark substep open" : "Mark substep done"}
                      className={cn(
                        "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-all",
                        sub.done ? "border-transparent text-bg" : "border-border-strong text-transparent hover:border-accent",
                      )}
                      style={sub.done ? { background: color } : undefined}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </button>
                    {editingSubId === sub.id ? (
                      <input
                        value={editingSubTitle}
                        onChange={(e) => setEditingSubTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveSubstepEdit(s.id, sub.id);
                          if (e.key === "Escape") setEditingSubId(null);
                        }}
                        onBlur={() => saveSubstepEdit(s.id, sub.id)}
                        autoFocus
                        className="flex-1 rounded-md border border-accent bg-surface-2 px-2 py-0.5 text-[13px] text-text outline-none min-w-0"
                      />
                    ) : (
                      <span
                        onClick={() => startEditingSubstep(sub.id, sub.title)}
                        className={cn(
                          "flex-1 text-[13px] leading-snug break-words min-w-0 cursor-pointer hover:text-accent transition-colors group/subtitle flex items-center gap-1.5",
                          sub.done ? "text-faint line-through" : "text-text",
                        )}
                        title="Click to edit substep title"
                      >
                        <span className="flex-1 min-w-0">{sub.title}</span>
                        <Pencil className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover/subtitle:opacity-60 transition-opacity" />
                      </span>
                    )}
                    <button
                      onClick={() => deleteSubstep(topic.id, s.id, sub.id)}
                      aria-label="Delete substep"
                      className="grid h-5 w-5 shrink-0 place-items-center rounded text-faint transition-opacity hover:text-danger opacity-70 sm:opacity-0 sm:group-hover/sub:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {/* Substep Inline Input */}
                {addingSubFor === s.id && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      value={subDrafts[s.id] || ""}
                      onChange={(e) => setSubDrafts({ ...subDrafts, [s.id]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSubstep(s.id)}
                      placeholder="Add sub-task/substep…"
                      autoFocus
                      className="flex-1 rounded-lg border border-dashed border-border bg-transparent px-2.5 py-1 text-[13px] text-text outline-none placeholder:text-faint focus:border-border-strong"
                    />
                    <button
                      onClick={() => handleAddSubstep(s.id)}
                      disabled={!(subDrafts[s.id] || "").trim()}
                      className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-fg disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Big Step Input */}
      <div className="flex items-center gap-2 pt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addBigStep()}
          placeholder="Next big step to learn…"
          className="flex-1 rounded-[10px] border border-dashed border-border bg-transparent px-3 py-2 text-sm text-text outline-none placeholder:text-faint focus:border-border-strong"
        />
        <button
          onClick={addBigStep}
          disabled={!draft.trim()}
          aria-label="Add step"
          className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent text-accent-fg transition-opacity disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
