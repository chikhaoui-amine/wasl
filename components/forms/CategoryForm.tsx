"use client";

import { useState } from "react";
import { Modal, Field, FormFooter, inputCls } from "@/components/ui/Modal";
import { useNotesData, type NoteCategory } from "@/lib/data/domains/notes";
import { Tag, Plus, X, ChevronUp, ChevronDown } from "lucide-react";

const PRESET_COLORS = [
  "#37c9b7", // Teal/Accent
  "#7c9cf5", // Accent 2 / Blue
  "#f59e0b", // Amber/Warn
  "#10b981", // Emerald/Success
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#ef4444", // Red
  "#6b7280", // Slate
];

export function CategoryForm(props: {
  open: boolean;
  onClose: () => void;
  category?: NoteCategory;
  onSaved?: (saved: NoteCategory, oldName?: string) => void;
  onDeleted?: (deletedId: string, deletedName: string) => void;
}) {
  if (!props.open) return null;
  return <CategoryFormInner key={props.category?.id ?? "new"} {...props} />;
}

function CategoryFormInner({
  open,
  onClose,
  category,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  category?: NoteCategory;
  onSaved?: (saved: NoteCategory, oldName?: string) => void;
  onDeleted?: (deletedId: string, deletedName: string) => void;
}) {
  const { addCategory, updateCategory, deleteCategory } = useNotesData();
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? PRESET_COLORS[0]);
  const [sections, setSections] = useState<string[]>(category?.sections ?? []);
  const [newSection, setNewSection] = useState("");

  const handleAddSection = () => {
    const trimmed = newSection.trim();
    if (!trimmed) return;
    if (sections.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setNewSection("");
      return;
    }
    setSections([...sections, trimmed]);
    setNewSection("");
  };

  const handleRemoveSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const handleMoveSection = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    setSections(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (category) {
      await updateCategory(category.id, { name: trimmedName, color, sections }, category.name);
      onSaved?.({ ...category, name: trimmedName, color, sections }, category.name);
    } else {
      const created = await addCategory({ name: trimmedName, color, sections });
      onSaved?.(created);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={category ? "Edit Page / Category" : "New Page / Category"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Page Name">
          <input
            autoFocus
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Personal, Ideas, Drafts, Work, Books..."
          />
        </Field>

        <Field label="Theme Color">
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition-transform ${
                  color === c ? "scale-110 ring-2 ring-accent ring-offset-2 ring-offset-bg" : "opacity-80 hover:opacity-100"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>

        <Field label="Page Sections / Dividing Tags">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                className={inputCls}
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSection();
                  }
                }}
                placeholder="e.g. Approved, Rejected, In Review..."
              />
              <button
                type="button"
                onClick={handleAddSection}
                disabled={!newSection.trim()}
                className="flex items-center gap-1 rounded-lg bg-surface-2 border border-border px-3 py-2 text-xs font-semibold text-text hover:bg-surface-hover hover:border-accent disabled:opacity-40 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>

            {sections.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {sections.map((sec, idx) => (
                  <div
                    key={sec}
                    className="flex items-center gap-1 rounded-full border border-border bg-surface-1 pl-2.5 pr-1.5 py-1 text-xs font-medium text-text shadow-xs"
                  >
                    <Tag className="h-3 w-3 text-accent" />
                    <span>{sec}</span>
                    <div className="flex items-center gap-0.5 ml-1 border-l border-border/50 pl-1">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleMoveSection(idx, "up")}
                          title="Move up"
                          className="text-faint hover:text-text p-0.5"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                      )}
                      {idx < sections.length - 1 && (
                        <button
                          type="button"
                          onClick={() => handleMoveSection(idx, "down")}
                          title="Move down"
                          className="text-faint hover:text-text p-0.5"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(idx)}
                        title="Remove section"
                        className="text-faint hover:text-danger p-0.5 ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-faint">
                Optional: Add tags (like &ldquo;Approved&rdquo; / &ldquo;Rejected&rdquo;) to divide notes on this page into vertical sections.
              </p>
            )}
          </div>
        </Field>

        <FormFooter
          submitLabel={category ? "Save changes" : "Create page"}
          disabled={!name.trim()}
          onDelete={
            category
              ? async () => {
                  await deleteCategory(category.id, category.name);
                  onDeleted?.(category.id, category.name);
                  onClose();
                }
              : undefined
          }
        />
      </form>
    </Modal>
  );
}
