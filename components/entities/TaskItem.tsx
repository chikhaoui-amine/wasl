"use client";

import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { useTasksData, type Task } from "@/lib/data/domains/tasks";
import { TaskForm } from "@/components/forms/TaskForm";
import { relLabel } from "@/lib/date";
import { cn } from "@/lib/utils";

export function TaskItem({
  task,
  showDue = false,
}: {
  task: Task;
  showDue?: boolean;
}) {
  const { toggleTask } = useTasksData();
  const [editing, setEditing] = useState(false);

  const done = task.status === "done";

  return (
    <>
      <div className="group flex items-center gap-2.5 sm:gap-3 rounded-[10px] sm:rounded-[12px] px-2 py-1.5 sm:py-2 transition-colors hover:bg-surface-2">
        <button
          onClick={() => toggleTask(task.id)}
          aria-label={done ? "Mark incomplete" : "Mark complete"}
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all",
            done
              ? "border-success bg-success text-bg"
              : "border-border-strong text-transparent hover:border-accent",
          )}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </button>

        {!done && task.priority === "high" && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
            style={{ boxShadow: "0 0 6px var(--danger)" }}
            title="High priority"
          />
        )}

        <button
          onClick={() => setEditing(true)}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-[13px] sm:text-sm",
            done ? "text-faint line-through" : "text-text",
          )}
        >
          {task.title}
        </button>

        {showDue && task.due && !done && (
          <span className="hidden shrink-0 text-[11px] text-faint sm:inline">{relLabel(task.due)}</span>
        )}

        <button
          onClick={() => setEditing(true)}
          aria-label="Edit task"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-faint opacity-70 transition-opacity hover:bg-surface-2 hover:text-muted sm:opacity-0 group-hover:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <TaskForm open={editing} onClose={() => setEditing(false)} task={task} />
    </>
  );
}
