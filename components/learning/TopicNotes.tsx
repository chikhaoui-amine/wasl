"use client";

import { useMemo, useState } from "react";
import { BookOpen, Headphones, Lightbulb, Pencil, Pin, Plus, StickyNote } from "lucide-react";
import { NoteForm, type NoteFormData } from "@/components/forms/NoteForm";
import { NoteDetail } from "@/components/details/NoteDetail";
import { isRtlText } from "@/components/ui/MarkdownRenderer";
import { relTime } from "@/lib/data/domains/notes";
import { useTopicsData, type Topic, type TopicNote } from "@/lib/data/domains/topics";
import type { Note, NoteContentType } from "@/lib/data/domains/notes";
import { cn } from "@/lib/utils";
import { useDataEdition } from "@/lib/data/query/provider";

const TYPE_ICONS: Record<NoteContentType, typeof StickyNote> = { note: StickyNote, read: BookOpen, listen: Headphones, idea: Lightbulb };
const TYPE_LABELS: Record<NoteContentType, string> = { note: "Note", read: "Read", listen: "Listen", idea: "Idea" };

export function TopicNotes({ topic }: { topic: Topic }) {
  const { addNote, updateNote, deleteNote, toggleNotePin } = useTopicsData();
  const edition = useDataEdition();
  const [editing, setEditing] = useState<Note | undefined>();
  const [reading, setReading] = useState<Note | undefined>();
  const [creating, setCreating] = useState(false);

  const notes = useMemo(() => topic.notes.map((note): Note => ({
    id: note.id,
    title: note.title,
    body: note.text,
    tag: topic.name,
    pinned: Boolean(note.pinned),
    updatedAt: note.updatedAt || note.createdAt,
    contentType: note.contentType || "note",
    sourceUrl: note.sourceUrl,
    author: note.author,
  })), [topic]);

  const toTopicNote = (input: Partial<Note>, existing?: TopicNote): Partial<TopicNote> => ({
    ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
    ...(input.contentType ? { contentType: input.contentType } : {}),
    ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
    ...(input.author !== undefined ? { author: input.author } : {}),
    ...(existing ? {} : { createdAt: Date.now() }),
  });

  const data: NoteFormData = {
    categories: [{ name: topic.name, color: topic.color }],
    edition,
    addNote: async (input) => {
      const created = await addNote(topic.id, input.title, input.body, toTopicNote(input));
      return { id: created.id, title: created.title, body: created.text, tag: topic.name, pinned: Boolean(created.pinned), updatedAt: created.updatedAt, contentType: created.contentType, sourceUrl: created.sourceUrl, author: created.author };
    },
    updateNote: async (id, patch) => {
      const existing = topic.notes.find((note) => note.id === id);
      await updateNote(topic.id, id, patch.title ?? existing?.title ?? "", patch.body ?? existing?.text ?? "", toTopicNote(patch, existing));
    },
    deleteNote: (id) => deleteNote(topic.id, id),
  };

  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text"><StickyNote className="h-3.5 w-3.5" /> Notes &amp; Insights</h2>
        <button onClick={() => setCreating(true)} className="btn-hero flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"><Plus className="h-3.5 w-3.5" /> New Item</button>
      </div>
      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-faint">No notes yet. Click <strong className="text-accent">+ New Item</strong> to capture what you learn.</div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {[...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt).map((note) => {
            const Icon = TYPE_ICONS[note.contentType || "note"];
            return <article key={note.id} className="card card-hover mb-3 block break-inside-avoid p-4 transition-all group">
              <div className="mb-2 flex items-center justify-between"><span className="text-[11px] text-faint">{relTime(note.updatedAt)}</span><div className="flex items-center gap-1"><button onClick={() => setEditing(note)} title="Edit note" className="grid h-6 w-6 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-accent"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => toggleNotePin(topic.id, note.id)} title={note.pinned ? "Unpin note" : "Pin note"} className={cn("grid h-6 w-6 place-items-center rounded-md hover:bg-surface-2", note.pinned ? "text-accent" : "text-faint")}><Pin className={cn("h-3.5 w-3.5", note.pinned && "fill-current")} style={{ rotate: "45deg" }} /></button></div></div>
              <button onClick={() => setReading(note)} className="block w-full text-left"><div className="mb-2 flex items-center gap-1.5 text-[11px] text-faint"><Icon className="h-3 w-3" /> {TYPE_LABELS[note.contentType || "note"]}</div><h3 dir={isRtlText(note.title) ? "rtl" : "ltr"} className={cn("font-display text-base sm:text-lg font-bold leading-snug text-text group-hover:text-accent", isRtlText(note.title) ? "text-right" : "text-left")}>{note.title || "Untitled Note"}</h3>{note.author && <p className="mt-1 text-xs font-medium text-accent">By {note.author}</p>}</button>
            </article>;
          })}
        </div>
      )}
      <NoteForm open={creating} onClose={() => setCreating(false)} data={data} />
      <NoteForm open={!!editing} onClose={() => setEditing(undefined)} note={editing} data={data} />
      <NoteDetail note={reading} onClose={() => setReading(undefined)} onEdit={() => { const note = reading; setReading(undefined); setEditing(note); }} data={{ categories: data.categories, deleteNote: data.deleteNote, togglePin: (id) => toggleNotePin(topic.id, id) }} />
    </section>
  );
}
