"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Lightbulb, ListChecks, NotebookText, Sun } from "lucide-react";
import { useUI } from "@/lib/store";
import { useTasksData } from "@/lib/data/domains/tasks";
import { useNotesData } from "@/lib/data/domains/notes";
import { cn } from "@/lib/utils";

const TYPES = [
  { id: "task", label: "Task", icon: ListChecks },
  { id: "idea", label: "Idea", icon: Lightbulb },
  { id: "note", label: "Note", icon: NotebookText },
] as const;

type CaptureType = (typeof TYPES)[number]["id"];

export function QuickCapture() {
  const captureOpen = useUI((s) => s.captureOpen);
  const setCaptureOpen = useUI((s) => s.setCaptureOpen);
  const { addTask } = useTasksData();
  const { addNote } = useNotesData();

  const [type, setType] = useState<CaptureType>("task");
  const [value, setValue] = useState("");
  const [today, setToday] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const close = () => {
    setCaptureOpen(false);
    setTimeout(() => {
      setValue("");
      setSavedMsg(null);
      setType("task");
      setToday(false);
    }, 200);
  };

  // Escape closes capture.
  useEffect(() => {
    if (!captureOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close identity is stable per open
  }, [captureOpen]);

  const save = async () => {
    const text = value.trim();
    if (!text) return;
    if (type === "task") {
      await addTask({ title: text, priority: "med", today });
      setSavedMsg(today ? "Added to Today" : "Added to Tasks");
    } else {
      await addNote({
        title: text.split(/[.\n]/)[0].slice(0, 48),
        body: text,
        tag: type === "idea" ? "Idea" : "Personal",
      });
      setSavedMsg("Saved to Notes");
    }
    setTimeout(close, 750);
  };

  return (
    <AnimatePresence>
      {captureOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[16vh] backdrop-blur-md"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.34, 1.4, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="card-glass w-full max-w-lg overflow-hidden rounded-[24px] shadow-float"
          >
            {savedMsg ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                >
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </motion.div>
                <p className="text-sm font-medium text-text">{savedMsg}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 border-b border-border p-2.5">
                  {TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = t.id === type;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setType(t.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                          active
                            ? "bg-accent-soft text-accent"
                            : "text-faint hover:bg-surface-hover hover:text-muted",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                      </button>
                    );
                  })}

                  {type === "task" && (
                    <button
                      onClick={() => setToday((v) => !v)}
                      className={cn(
                        "ml-auto flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                        today ? "bg-accent-soft text-accent" : "text-faint hover:text-muted",
                      )}
                    >
                      <Sun className="h-3.5 w-3.5" /> Today
                    </button>
                  )}
                </div>

                <textarea
                  autoFocus
                  rows={3}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      save();
                    }
                  }}
                  placeholder={
                    type === "task"
                      ? "What needs doing?"
                      : type === "idea"
                        ? "What's the idea?"
                        : "Jot it down…"
                  }
                  className="w-full resize-none bg-transparent px-4 py-4 text-[15px] text-text outline-none placeholder:text-faint"
                />

                <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                  <span className="text-[11px] text-faint">
                    {type === "task"
                      ? today
                        ? "Lands in Today."
                        : "Lands in Tasks · triage later."
                      : "Lands in Notes."}{" "}
                    Enter to save.
                  </span>
                  <button
                    onClick={save}
                    disabled={!value.trim()}
                    className="btn-hero rounded-full px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-40"
                  >
                    Capture
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
