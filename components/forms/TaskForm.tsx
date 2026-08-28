"use client";

import { useState } from "react";
import { Modal, Field, FormFooter, Segmented, inputCls } from "@/components/ui/Modal";
import { useTasksData, type Task, type Priority } from "@/lib/data/domains/tasks";
import { useGoalsData } from "@/lib/data/domains/goals";

export function TaskForm(props: {
  open: boolean;
  onClose: () => void;
  task?: Task; // edit mode when provided
  defaults?: { goalId?: string; today?: boolean; weekly?: boolean };
}) {
  if (!props.open) return null;
  return <TaskFormInner key={props.task?.id ?? "new"} {...props} />;
}

function TaskFormInner({
  open,
  onClose,
  task,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task;
  defaults?: { goalId?: string; today?: boolean; weekly?: boolean };
}) {
  const { addTask, updateTask, deleteTask } = useTasksData();
  const { goals } = useGoalsData();

  const [title, setTitle] = useState(task?.title ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "med");
  const [goalId, setGoalId] = useState<string>(task?.goalId ?? defaults?.goalId ?? "");
  const [due, setDue] = useState(task?.due ?? "");
  const [today, setToday] = useState(task?.today ?? defaults?.today ?? false);
  const [weekly, setWeekly] = useState(task?.weekly ?? defaults?.weekly ?? false);
  const [estimate, setEstimate] = useState(task?.estimateMin ? String(task.estimateMin) : "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const input = {
      title: title.trim(),
      priority,
      goalId: goalId || undefined,
      due: due || undefined,
      today,
      weekly,
      estimateMin: estimate ? Number(estimate) : undefined,
    };
    if (task) await updateTask(task.id, input);
    else await addTask(input);
    onClose();
  };

  const isDirty = Boolean(title.trim() !== (task?.title ?? ""));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      preventBackdropClose={true}
      dirty={isDirty}
      confirmDiscardMessage="You have unsaved changes in this task. Discard edits?"
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="What needs doing?">
          <input autoFocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
        </Field>

        <Field label="Priority">
          <Segmented
            value={priority}
            onChange={setPriority}
            options={[
              { value: "low", label: "Low" },
              { value: "med", label: "Med" },
              { value: "high", label: "High" },
            ]}
          />
        </Field>

        <Field label="Goal / Monthly Focus (optional)">
          <select className={inputCls} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">None</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.type === "monthly_outcome" ? `🎯 Monthly: ${g.title}` : g.title}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <Field label="Due date">
            <input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Estimate (min)">
            <input
              type="number"
              min={5}
              step={5}
              className={inputCls}
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              placeholder="e.g. 45"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-border px-2.5 sm:px-3 py-2 sm:py-2.5">
            <input
              type="checkbox"
              checked={today}
              onChange={(e) => setToday(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span className="text-[12.5px] sm:text-[13px] text-text">Do today</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-border px-2.5 sm:px-3 py-2 sm:py-2.5">
            <input
              type="checkbox"
              checked={weekly}
              onChange={(e) => setWeekly(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span className="text-[12.5px] sm:text-[13px] text-text">Weekly Task</span>
          </label>
        </div>

        <FormFooter
          submitLabel={task ? "Save changes" : "Add task"}
          disabled={!title.trim()}
          onDelete={
            task
              ? async () => {
                  try {
                    await deleteTask(task.id);
                    onClose();
                  } catch (err) {
                    console.error("Failed to delete task:", err);
                  }
                }
              : undefined
          }
        />
      </form>
    </Modal>
  );
}
