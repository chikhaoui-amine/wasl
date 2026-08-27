"use client";

import { useState } from "react";
import { Check, Plus, X, Pencil, ChevronUp, ChevronDown } from "lucide-react";
import type { Milestone } from "@/lib/data/domains/goals";
import { useTasksData, type Task, type TaskInput } from "@/lib/data/domains/tasks";
import { TaskItem } from "@/components/entities/TaskItem";
import { cn } from "@/lib/utils";

export function DetailSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{title}</h3>
        {count && <span className="tabular text-[11px] text-faint">{count}</span>}
      </div>
      {children}
    </section>
  );
}

/** Free-form plan text — saves on blur. */
export function PlanEditor({
  value,
  onSave,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(value);
  return (
    <textarea
      rows={3}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onSave(text)}
      placeholder={placeholder}
      className="w-full resize-y rounded-[12px] bg-surface-2 px-3.5 py-3 text-[14px] leading-relaxed text-text outline-none placeholder:text-faint"
    />
  );
}

export function MilestoneList({
  milestones,
  onToggle,
  onAdd,
  onDelete,
  onUpdate,
  onMove,
}: {
  milestones: Milestone[];
  onToggle: (id: string) => void;
  onAdd: (title: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, title: string) => void;
  onMove?: (id: string, direction: "up" | "down") => void;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const add = () => {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft("");
  };

  const startEdit = (m: Milestone) => {
    setEditingId(m.id);
    setEditingTitle(m.title);
  };

  const saveEdit = (id: string) => {
    if (editingTitle.trim() && onUpdate) {
      onUpdate(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-1.5">
      {milestones.map((m, idx) => (
        <div
          key={m.id}
          className="group flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 bg-surface-2/40 hover:bg-surface-2 transition-colors"
        >
          {/* Reorder Buttons */}
          {onMove && milestones.length > 1 && (
            <div className="flex flex-col gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => onMove(m.id, "up")}
                className="p-0.5 text-faint hover:text-text disabled:opacity-20 disabled:hover:text-faint rounded"
                title="Move milestone up"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                disabled={idx === milestones.length - 1}
                onClick={() => onMove(m.id, "down")}
                className="p-0.5 text-faint hover:text-text disabled:opacity-20 disabled:hover:text-faint rounded"
                title="Move milestone down"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Completion Checkbox */}
          <button
            type="button"
            onClick={() => onToggle(m.id)}
            aria-label={m.done ? "Mark milestone open" : "Mark milestone done"}
            className={cn(
              "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all",
              m.done
                ? "border-success bg-success text-bg"
                : "border-border-strong text-transparent hover:border-accent",
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </button>

          {/* Title or Inline Edit Input */}
          {editingId === m.id ? (
            <input
              autoFocus
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit(m.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              onBlur={() => saveEdit(m.id)}
              className="flex-1 bg-surface-1 border border-accent/60 rounded px-2 py-0.5 text-sm text-text outline-none"
            />
          ) : (
            <span
              onClick={() => onUpdate && startEdit(m)}
              className={cn(
                "flex-1 text-sm cursor-text hover:text-accent transition-colors",
                m.done ? "text-faint line-through" : "text-text",
              )}
              title={onUpdate ? "Click to edit milestone" : undefined}
            >
              {m.title}
            </span>
          )}

          {/* Action buttons (Edit & Delete) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onUpdate && editingId !== m.id && (
              <button
                type="button"
                onClick={() => startEdit(m)}
                aria-label="Edit milestone"
                className="grid h-6 w-6 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-text"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(m.id)}
              aria-label="Delete milestone"
              className="grid h-6 w-6 place-items-center rounded-md text-faint hover:bg-surface-3 hover:text-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a milestone…"
          className="flex-1 rounded-[10px] border border-dashed border-border bg-transparent px-3 py-2 text-sm text-text outline-none placeholder:text-faint focus:border-border-strong"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="rounded-[10px] bg-accent-soft px-3 py-2 text-xs font-semibold text-accent disabled:opacity-40 hover:bg-accent/20 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function LinkedTasks({
  tasks,
  quickAddDefaults,
}: {
  tasks: Task[];
  quickAddDefaults?: Partial<TaskInput>;
}) {
  const { addTask } = useTasksData();
  const [draft, setDraft] = useState("");

  const add = async () => {
    if (!draft.trim()) return;
    await addTask({ priority: "med", today: false, weekly: false, ...quickAddDefaults, title: draft.trim() });
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {tasks.length > 0 ? (
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} />
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-faint">No tasks linked directly to this item.</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a task linked to this goal…"
          className="flex-1 rounded-[10px] border border-dashed border-border bg-transparent px-3 py-2 text-sm text-text outline-none placeholder:text-faint focus:border-border-strong"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="rounded-[10px] bg-accent-soft px-3 py-2 text-xs font-semibold text-accent disabled:opacity-40 hover:bg-accent/20 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
