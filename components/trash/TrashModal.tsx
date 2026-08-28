"use client";

import { useState } from "react";
import { Trash2, RotateCcw, Dumbbell, CheckSquare, StickyNote, Target, Sparkles } from "lucide-react";
import { useTrashData, type TrashItemType } from "@/lib/data/domains/trash";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

interface TrashModalProps {
  open: boolean;
  onClose: () => void;
}

export function TrashModal({ open, onClose }: TrashModalProps) {
  const { items, restoreItem, deletePermanently, emptyTrash, restoreDefaultPrograms } = useTrashData();
  const [filter, setFilter] = useState<"all" | "health" | "tasks" | "notes">("all");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (filter === "health") return item.itemType === "program" || item.itemType === "workout";
    if (filter === "tasks") return item.itemType === "task" || item.itemType === "habit";
    if (filter === "notes") return item.itemType === "note" || item.itemType === "goal";
    return true;
  });

  const getIcon = (type: TrashItemType) => {
    switch (type) {
      case "program":
      case "workout":
        return <Dumbbell className="h-4 w-4 text-accent" />;
      case "task":
      case "habit":
        return <CheckSquare className="h-4 w-4 text-emerald-400" />;
      case "note":
        return <StickyNote className="h-4 w-4 text-amber-400" />;
      default:
        return <Target className="h-4 w-4 text-indigo-400" />;
    }
  };

  const handleRestore = async (id: string) => {
    setErrorMsg(null);
    try {
      await restoreItem(id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to restore item.";
      setErrorMsg(msg);
    }
  };

  const handleDeletePermanently = async (id: string) => {
    if (confirm("Are you sure you want to permanently delete this item? This action cannot be undone.")) {
      setErrorMsg(null);
      try {
        await deletePermanently(id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to delete item permanently.";
        setErrorMsg(msg);
      }
    }
  };

  const handleEmptyTrash = async () => {
    if (confirm("Are you sure you want to permanently delete all items in trash?")) {
      setErrorMsg(null);
      try {
        await emptyTrash();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to empty trash.";
        setErrorMsg(msg);
      }
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="3xl" title="Trash & Recovery">
      <div className="space-y-4">
        {/* Error Banner */}
        {errorMsg && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs font-semibold hover:underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Helper Banner for Default Programs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 rounded-xl border border-accent/30 bg-accent/10 p-2.5 sm:p-3 text-xs text-text">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent shrink-0" />
            <span>Missing standard training programs? Restore defaults anytime.</span>
          </div>
          <button
            onClick={async () => {
              await restoreDefaultPrograms();
              onClose();
            }}
            className="btn-hero self-start sm:self-auto px-3 py-1.5 text-[11px] font-semibold shrink-0"
          >
            Restore Defaults
          </button>
        </div>

        {/* Filter Tabs & Empty Trash */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-lg text-xs overflow-x-auto scrollbar-none max-w-full">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition",
                filter === "all" ? "bg-surface-1 text-text shadow-sm" : "text-muted hover:text-text",
              )}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilter("health")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition",
                filter === "health" ? "bg-surface-1 text-text shadow-sm" : "text-muted hover:text-text",
              )}
            >
              Health
            </button>
            <button
              onClick={() => setFilter("tasks")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition",
                filter === "tasks" ? "bg-surface-1 text-text shadow-sm" : "text-muted hover:text-text",
              )}
            >
              Tasks & Habits
            </button>
            <button
              onClick={() => setFilter("notes")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition",
                filter === "notes" ? "bg-surface-1 text-text shadow-sm" : "text-muted hover:text-text",
              )}
            >
              Notes & Goals
            </button>
          </div>

          {items.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1 px-2 py-1 ml-auto"
            >
              <Trash2 className="h-3.5 w-3.5" /> Empty Trash
            </button>
          )}
        </div>

        {/* Trashed Items List */}
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">No items in trash.</div>
        ) : (
          <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border border-border/60 bg-surface-1/60 hover:bg-surface-1 transition"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-surface-2 mt-0.5">{getIcon(item.itemType)}</div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-text truncate">{item.title}</h4>
                    {item.description && <p className="text-xs text-muted line-clamp-1 mt-0.5">{item.description}</p>}
                    <span className="text-[10px] text-faint block mt-0.5">
                      Deleted {new Date(item.deletedAt).toLocaleDateString()} at{" "}
                      {new Date(item.deletedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => handleRestore(item.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 text-xs font-semibold transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </button>
                  <button
                    onClick={() => handleDeletePermanently(item.id)}
                    className="p-1.5 rounded-lg text-faint hover:text-red-400 hover:bg-surface-2 transition"
                    title="Delete permanently"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
