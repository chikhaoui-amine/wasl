"use client";

import { useState, useRef } from "react";
import {
  BookOpen,
  ExternalLink,
  Headphones,
  Lightbulb,
  Pencil,
  Pin,
  Plus,
  Search,
  StickyNote,
  FolderPlus,
  LayoutGrid,
  Columns2,
  List as ListIcon,
  Network,
  Upload,
  Loader2,
} from "lucide-react";
import { importMarkdownFiles } from "@/lib/notes-import";
import { useNotesData, relTime, type Note, type NoteCategory, type NoteContentType } from "@/lib/data/domains/notes";
import { NoteForm } from "@/components/forms/NoteForm";
import { NoteDetail } from "@/components/details/NoteDetail";
import { CategoryForm } from "@/components/forms/CategoryForm";
import { NoteSplitView } from "@/components/notes/NoteSplitView";
import { NoteListView } from "@/components/notes/NoteListView";
import { NotesGraphView } from "@/components/notes/NotesGraphView";
import { isRtlText } from "@/components/ui/MarkdownRenderer";
import { Card } from "@/components/ui/primitives";
import { Hydrate } from "@/lib/hydration";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "split" | "list";

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

function NoteCard({
  note,
  onRead,
  onEdit,
}: {
  note: Note;
  onRead: () => void;
  onEdit: () => void;
}) {
  const { togglePin, categories } = useNotesData();
  const category = categories.find((c) => c.name.toLowerCase() === note.tag.toLowerCase());
  const categoryColor = category?.color || "var(--accent)";

  const contentType: NoteContentType = note.contentType || "note";
  const Icon = TYPE_ICONS[contentType] || StickyNote;

  return (
    <article className="card card-hover mb-3 sm:mb-4 block break-inside-avoid p-4 sm:p-5 transition-all group">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              background: `color-mix(in oklab, ${categoryColor} 14%, transparent)`,
              color: categoryColor,
            }}
          >
            {note.tag}
          </span>
          <span className="inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-faint font-medium">
            <Icon className="h-3 w-3" />
            {TYPE_LABELS[contentType]}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onEdit}
            title="Edit note"
            className="grid h-6 w-6 place-items-center rounded-md text-faint opacity-60 transition-all hover:bg-surface-2 hover:text-accent hover:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => togglePin(note.id)}
            aria-label={note.pinned ? "Unpin" : "Pin"}
            className={cn(
              "grid h-6 w-6 place-items-center rounded-md transition-colors hover:bg-surface-2",
              note.pinned ? "text-accent" : "text-faint hover:text-muted",
            )}
          >
            <Pin className={cn("h-3.5 w-3.5", note.pinned && "fill-current")} style={{ rotate: "45deg" }} />
          </button>
        </div>
      </div>

      <button onClick={onRead} className="block w-full text-left group-hover:opacity-95 transition-opacity">
        {/* Note Title - Only Title Appears */}
        <h3
          dir={isRtlText(note.title) ? "rtl" : "ltr"}
          className={cn(
            "font-display text-base sm:text-lg font-bold leading-snug text-text group-hover:text-accent transition-colors",
            isRtlText(note.title) ? "text-right" : "text-left",
          )}
        >
          {note.title}
        </h3>

        {note.author && (
          <p className="mt-1 text-[12px] font-medium text-accent">
            By {note.author}
          </p>
        )}
      </button>

      {note.sourceUrl && (
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-faint border-t border-border/40 pt-2">
          <span>{relTime(note.updatedAt)}</span>
          <a
            href={note.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </article>
  );
}

export default function NotesPage() {
  const { notes, categories, addNote, addCategory, updateCategory } = useNotesData();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const handleUpdateCategoryLinks = async (
    idOrName: string,
    patch: { name?: string; color?: string; icon?: string; linkedCategoryIds?: string[] },
  ) => {
    const existing = categories.find(
      (c) => c.id === idOrName || c.name.toLowerCase().trim() === idOrName.toLowerCase().trim(),
    );
    if (existing) {
      await updateCategory(existing.id, patch);
    } else {
      await addCategory({
        name: patch.name || idOrName,
        color: patch.color || "var(--accent)",
        icon: patch.icon,
        linkedCategoryIds: patch.linkedCategoryIds,
      });
    }
  };
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    try {
      const saved = (sessionStorage.getItem("wasl_notes_view_mode") || sessionStorage.getItem("lifeos_notes_view_mode")) as ViewMode;
      if (saved && (saved === "grid" || saved === "split" || saved === "list")) {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return "grid";
  });
  const [activeSplitNoteId, setActiveSplitNoteId] = useState<string | undefined>();
  const [creatingNote, setCreatingNote] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<NoteCategory | undefined>();
  const [readingNote, setReadingNote] = useState<Note | undefined>();
  const [editing, setEditing] = useState<Note | undefined>();

  const [importing, setImporting] = useState(false);
  const [importToast, setImportToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBatchImportMarkdown = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    try {
      const defaultTag = selectedCategory === "All" ? (categories[0]?.name || "Personal") : selectedCategory;
      const count = await importMarkdownFiles(files, defaultTag, async (noteData) => {
        await addNote(noteData);
      });
      setImportToast(`Successfully imported ${count} ${count === 1 ? "note" : "notes"}!`);
      setTimeout(() => setImportToast(null), 3500);
    } catch (err) {
      console.error("Batch import error:", err);
      setImportToast("Failed to import some markdown files.");
      setTimeout(() => setImportToast(null), 3500);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      sessionStorage.setItem("wasl_notes_view_mode", mode);
    } catch {
      // Ignore storage errors
    }
  };

  const filtered = notes.filter((n) => {
    const matchCat = selectedCategory === "All" || n.tag.toLowerCase() === selectedCategory.toLowerCase();
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q) ||
      n.tag.toLowerCase().includes(q) ||
      (n.author && n.author.toLowerCase().includes(q));

    return matchCat && matchSearch;
  });

  const sorted = [...filtered].sort(
    (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt,
  );

  return (
    <Hydrate>
      <div className="space-y-5">
        {/* Top Control Bar: Search, View Switcher & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes, articles, podcasts, author..."
              className="w-full rounded-full border border-border bg-surface-1 py-1.5 pl-9 pr-4 text-xs sm:text-sm text-text placeholder:text-faint transition-colors focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-between sm:justify-end">
            {/* View Mode Toggle Pill: Graph View on All Pages, Grid | Workspace | List on Category Pages */}
            {selectedCategory === "All" ? (
              <div className="flex items-center gap-1.5 rounded-full bg-surface-1 border border-border px-3.5 py-1.5 text-xs font-medium text-accent shadow-xs">
                <Network className="h-3.5 w-3.5" />
                <span>Graph View</span>
              </div>
            ) : (
              <div className="flex items-center rounded-full bg-surface-1 border border-border p-0.5">
                <button
                  onClick={() => handleSetViewMode("grid")}
                  title="Grid View"
                  className={cn(
                    "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all",
                    viewMode === "grid"
                      ? "bg-surface-2 text-accent shadow-xs"
                      : "text-faint hover:text-muted",
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Grid</span>
                </button>

                <button
                  onClick={() => handleSetViewMode("split")}
                  title="Workspace Split View"
                  className={cn(
                    "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all",
                    viewMode === "split"
                      ? "bg-surface-2 text-accent shadow-xs"
                      : "text-faint hover:text-muted",
                  )}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Workspace</span>
                </button>

                <button
                  onClick={() => handleSetViewMode("list")}
                  title="List View"
                  className={cn(
                    "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all",
                    viewMode === "list"
                      ? "bg-surface-2 text-accent shadow-xs"
                      : "text-faint hover:text-muted",
                  )}
                >
                  <ListIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            )}

            {/* Hidden file input for batch markdown import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.txt"
              multiple
              onChange={handleBatchImportMarkdown}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              title="Import markdown (.md) file(s) into current category"
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              ) : (
                <Upload className="h-3.5 w-3.5 text-accent" />
              )}
              <span className="hidden sm:inline">{importing ? "Importing..." : "Import .md"}</span>
              <span className="sm:hidden">{importing ? "..." : "Import"}</span>
            </button>

            <button
              onClick={() => setCreatingCategory(true)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">+ Custom Page</span>
              <span className="sm:hidden">+ Page</span>
            </button>

            <button
              onClick={() => setCreatingNote(true)}
              className="btn-hero flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-[13px] font-semibold"
            >
              <Plus className="h-4 w-4" /> New Item
            </button>
          </div>
        </div>

        {/* Import Toast Banner */}
        {importToast && (
          <div className="flex justify-center">
            <div className="rounded-full border border-accent/40 bg-surface-1/95 px-4 py-1.5 text-xs font-semibold text-accent shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
              {importToast}
            </div>
          </div>
        )}

        {/* Custom Pages / Category Filter Tabs */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedCategory("All")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors shrink-0",
                selectedCategory === "All"
                  ? "bg-accent-soft text-accent"
                  : "text-faint hover:bg-surface-hover hover:text-muted",
              )}
            >
              All Pages
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.name;
              return (
                <div
                  key={cat.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-full pl-3 pr-1.5 py-1 text-xs font-medium transition-colors shrink-0",
                    isSelected
                      ? "bg-accent-soft text-accent"
                      : "text-faint hover:bg-surface-hover hover:text-muted",
                  )}
                >
                  <button
                    onClick={() => setSelectedCategory(cat.name)}
                    className="flex items-center gap-1.5"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: cat.color || "var(--accent)" }}
                    />
                    <span>{cat.name}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCategory(cat);
                    }}
                    title="Edit or Delete Custom Page"
                    className="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-faint opacity-60 transition-opacity hover:opacity-100 hover:bg-surface-2"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Multi-View Notes Display: Graph on "All Pages", Grid/Split/List on Category Pages */}
        {selectedCategory === "All" ? (
          <NotesGraphView
            notes={sorted}
            categories={categories}
            search={search}
            onSelectNote={(n) => setReadingNote(n)}
            onSelectCategory={(catName) => setSelectedCategory(catName)}
            onUpdateCategory={handleUpdateCategoryLinks}
            onNewNote={() => setCreatingNote(true)}
          />
        ) : (
          <>
            {viewMode === "grid" && (
              sorted.length === 0 ? (
                <Card className="p-10 text-center text-sm text-faint">
                  {notes.length === 0 ? (
                    <>No items in your Knowledge Base yet. Click <strong>+ New Item</strong> to add thoughts, articles, or podcasts.</>
                  ) : (
                    <>No matching items found for this filter.</>
                  )}
                </Card>
              ) : (
                <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                  {sorted.map((n) => (
                    <NoteCard
                      key={n.id}
                      note={n}
                      onRead={() => setReadingNote(n)}
                      onEdit={() => setEditing(n)}
                    />
                  ))}
                </div>
              )
            )}

            {viewMode === "split" && (
              <NoteSplitView
                notes={sorted}
                categories={categories}
                activeNoteId={activeSplitNoteId}
                onSelectNote={(note) => setActiveSplitNoteId(note.id)}
                onNewNote={() => setCreatingNote(true)}
              />
            )}

            {viewMode === "list" && (
              <NoteListView
                notes={sorted}
                categories={categories}
                onRead={(note) => setReadingNote(note)}
                onEdit={(note) => setEditing(note)}
                onNewNote={() => setCreatingNote(true)}
              />
            )}
          </>
        )}
      </div>

      {/* Read Mode Detail Modal */}
      <NoteDetail
        note={readingNote}
        onClose={() => setReadingNote(undefined)}
        onEdit={() => {
          const target = readingNote;
          setReadingNote(undefined);
          setEditing(target);
        }}
      />

      {/* Edit Mode Modal */}
      <NoteForm open={creatingNote} onClose={() => setCreatingNote(false)} />
      <NoteForm open={!!editing} onClose={() => setEditing(undefined)} note={editing} />
      <CategoryForm open={creatingCategory} onClose={() => setCreatingCategory(false)} />
      <CategoryForm open={!!editingCategory} onClose={() => setEditingCategory(undefined)} category={editingCategory} />
    </Hydrate>
  );
}
