"use client";

import { useState } from "react";
import { Modal, Field, FormFooter, ColorDots, inputCls } from "@/components/ui/Modal";
import { useBlocksData, type Block } from "@/lib/data/domains/blocks";
import { todayISO } from "@/lib/date";

const BLOCK_COLORS = [
  "var(--accent)",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

const toTimeStr = (dec: number) => {
  const h = Math.floor(dec);
  const m = Math.round((dec - h) * 60);
  return `${`${h}`.padStart(2, "0")}:${`${m}`.padStart(2, "0")}`;
};
const fromTimeStr = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h + (m || 0) / 60;
};

export function BlockForm(props: {
  open: boolean;
  onClose: () => void;
  block?: Block;
  defaults?: { date?: string; start?: number; end?: number };
}) {
  if (!props.open) return null;
  return <BlockFormInner key={props.block?.id ?? "new"} {...props} />;
}

function BlockFormInner({
  open,
  onClose,
  block,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  block?: Block;
  defaults?: { date?: string; start?: number; end?: number };
}) {
  const { addBlock, updateBlock, deleteBlock } = useBlocksData();

  const initialStart = block?.start ?? defaults?.start ?? 9;
  const initialEnd = block?.end ?? defaults?.end ?? Math.min(23, initialStart + 1);

  const [title, setTitle] = useState(block?.title ?? "");
  const [date, setDate] = useState(block?.date ?? defaults?.date ?? todayISO());
  const [start, setStart] = useState(toTimeStr(initialStart));
  const [end, setEnd] = useState(toTimeStr(initialEnd));
  const [color, setColor] = useState(block?.color ?? BLOCK_COLORS[0]);

  const startDec = fromTimeStr(start);
  const endDec = fromTimeStr(end);
  const valid = title.trim().length > 0 && endDec > startDec;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const input = {
      title: title.trim(),
      date,
      start: startDec,
      end: endDec,
      color,
    };
    if (block) await updateBlock(block.id, input);
    else await addBlock(input);
    onClose();
  };

  const isDirty = Boolean(title.trim() !== (block?.title ?? ""));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={block ? "Edit block" : "New time block"}
      preventBackdropClose={true}
      dirty={isDirty}
      confirmDiscardMessage="You have unsaved changes in this time block. Discard edits?"
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="What are you doing?">
          <input autoFocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deep work, calls, gym…" />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Date">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Start">
            <input type="time" step={900} className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End">
            <input type="time" step={900} className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        {endDec <= startDec && (
          <p className="text-[12px] text-danger">End must be after start.</p>
        )}

        <Field label="Color">
          <ColorDots value={color} onChange={setColor} colors={BLOCK_COLORS} />
        </Field>

        <FormFooter
          submitLabel={block ? "Save changes" : "Add block"}
          disabled={!valid}
          onDelete={
            block
              ? async () => {
                  try {
                    await deleteBlock(block.id);
                    onClose();
                  } catch (err) {
                    console.error("Failed to delete block:", err);
                  }
                }
              : undefined
          }
        />
      </form>
    </Modal>
  );
}
