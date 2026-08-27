"use client";

import { useState } from "react";
import { Modal, Field, FormFooter, ColorDots, IconPicker, inputCls } from "@/components/ui/Modal";
import { useHabitsData, HABIT_COLORS, type Habit } from "@/lib/data/domains/habits";
import { HABIT_ICONS, DEFAULT_ICON, type IconKey } from "@/lib/icons";

export function HabitForm({
  open,
  onClose,
  habit,
}: {
  open: boolean;
  onClose: () => void;
  habit?: Habit;
}) {
  const { addHabit, updateHabit, deleteHabit } = useHabitsData();

  const [name, setName] = useState(habit?.name ?? "");
  const [icon, setIcon] = useState<IconKey>((habit?.icon as IconKey) ?? DEFAULT_ICON);
  const [target, setTarget] = useState(habit?.targetPerWeek ?? 7);
  const [color, setColor] = useState(habit?.color ?? HABIT_COLORS[0]);

  const [prevHabitId, setPrevHabitId] = useState<string | undefined>(habit?.id);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen || habit?.id !== prevHabitId) {
    setPrevOpen(open);
    setPrevHabitId(habit?.id);
    if (open) {
      setName(habit?.name ?? "");
      setIcon((habit?.icon as IconKey) ?? DEFAULT_ICON);
      setTarget(habit?.targetPerWeek ?? 7);
      setColor(habit?.color ?? HABIT_COLORS[0]);
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const input = { name: name.trim(), icon, targetPerWeek: target, color };
    if (habit) updateHabit(habit.id, input);
    else addHabit(input);
    onClose();
  };

  const isDirty = Boolean(name.trim() !== (habit?.name ?? ""));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={habit ? "Edit habit" : "New habit"}
      preventBackdropClose={true}
      dirty={isDirty}
      confirmDiscardMessage="You have unsaved changes in this habit. Discard edits?"
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Habit">
          <input
            autoFocus
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sleep by 12"
          />
        </Field>

        <Field label="Target (days per week)">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={7}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="flex-1 accent-teal"
            />
            <span className="font-mono text-sm font-semibold text-text">{target} / 7</span>
          </div>
        </Field>

        <Field label="Color">
          <ColorDots colors={HABIT_COLORS} value={color} onChange={setColor} />
        </Field>

        <Field label="Icon">
          <IconPicker
            icons={HABIT_ICONS}
            value={icon}
            onChange={setIcon}
          />
        </Field>

        <FormFooter
          onDelete={habit ? () => { deleteHabit(habit.id); onClose(); } : undefined}
          submitLabel={habit ? "Save changes" : "Create habit"}
          disabled={!name.trim()}
        />
      </form>
    </Modal>
  );
}
