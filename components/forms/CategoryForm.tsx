"use client";

import { useState } from "react";
import { Modal, Field, FormFooter, inputCls } from "@/components/ui/Modal";
import { useNotesData, type NoteCategory } from "@/lib/data/domains/notes";

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
}) {
  if (!props.open) return null;
  return <CategoryFormInner key={props.category?.id ?? "new"} {...props} />;
}

function CategoryFormInner({
  open,
  onClose,
  category,
}: {
  open: boolean;
  onClose: () => void;
  category?: NoteCategory;
}) {
  const { addCategory, updateCategory, deleteCategory } = useNotesData();
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? PRESET_COLORS[0]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (category) {
      await updateCategory(category.id, { name: name.trim(), color });
    } else {
      await addCategory({ name: name.trim(), color });
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

        <FormFooter
          submitLabel={category ? "Save changes" : "Create page"}
          disabled={!name.trim()}
          onDelete={
            category
              ? async () => {
                  await deleteCategory(category.id);
                  onClose();
                }
              : undefined
          }
        />
      </form>
    </Modal>
  );
}
