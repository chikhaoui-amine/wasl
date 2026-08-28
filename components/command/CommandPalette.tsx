"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CornerDownLeft,
  NotebookText,
  Palette,
  Target,
  Zap,
} from "lucide-react";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { THEMES } from "@/lib/themes";
import { useUI } from "@/lib/store";
import { useTasksData } from "@/lib/data/domains/tasks";
import { useNotesData } from "@/lib/data/domains/notes";
import { useGoalsData, goalProgress } from "@/lib/data/domains/goals";
import { ICON_MAP } from "@/lib/icons";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const commandOpen = useUI((s) => s.commandOpen);
  const setCommandOpen = useUI((s) => s.setCommandOpen);

  // Escape closes the palette (the footer hint promises this).
  useEffect(() => {
    if (!commandOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setCommandOpen(false);
      }
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [commandOpen, setCommandOpen]);

  return <AnimatePresence>{commandOpen && <PaletteContent />}</AnimatePresence>;
}

/**
 * Data subscriptions live here so tasks/notes/goals stores are only read while
 * the palette is actually open — previously they ran on every route, costing
 * three IndexedDB reads per first paint of every page.
 */
function PaletteContent() {
  const router = useRouter();
  const navItems = ALL_NAV_ITEMS;
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const setCaptureOpen = useUI((s) => s.setCaptureOpen);
  const setTheme = useUI((s) => s.setTheme);
  const { tasks, toggleTask } = useTasksData();
  const { notes } = useNotesData();
  const { goals } = useGoalsData();

  const run = (fn: () => void) => {
    setCommandOpen(false);
    requestAnimationFrame(fn);
  };

  const openTasks = tasks.filter((t) => t.status !== "done").slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-3 sm:p-4 pt-[6vh] sm:pt-[12vh] backdrop-blur-md"
      onClick={() => setCommandOpen(false)}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="card-glass w-full max-w-xl overflow-hidden rounded-[20px] sm:rounded-[24px] shadow-float"
      >
        <Command
          loop
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 sm:[&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-faint"
        >
          <div className="border-b border-border px-3.5 sm:px-4">
            <Command.Input
              autoFocus
              placeholder="Search tasks, notes, projects — or jump anywhere…"
              className="h-11 sm:h-14 w-full bg-transparent text-sm sm:text-[15px] text-text outline-none placeholder:text-faint"
            />
          </div>
          <Command.List className="max-h-[58vh] sm:max-h-[52vh] overflow-y-auto p-1.5 sm:p-2">
            <Command.Empty className="py-8 text-center text-sm text-faint">
              Nothing found.
            </Command.Empty>

            <Command.Group heading="Actions">
              <Item onSelect={() => run(() => setCaptureOpen(true))}>
                <Zap className="h-4 w-4 text-accent" />
                <span className="flex-1">Capture something</span>
                <span className="text-[11px] text-faint">C</span>
              </Item>
            </Command.Group>

            <Command.Group heading="Jump to">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Item
                    key={item.href}
                    value={`go ${item.label} ${item.hint}`}
                    onSelect={() => run(() => router.push(item.href))}
                  >
                    <Icon className="h-4 w-4 text-muted" />
                    <span className="flex-1">{item.label}</span>
                    <span className="hidden text-[11px] text-faint sm:inline">
                      {item.hint}
                    </span>
                  </Item>
                );
              })}
            </Command.Group>

            <Command.Group heading="Open tasks — enter to complete">
              {openTasks.map((t) => (
                <Item
                  key={t.id}
                  value={`task ${t.title}`}
                  onSelect={() => toggleTask(t.id)}
                >
                  <Check className="h-4 w-4 text-success" />
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.today && (
                    <span className="text-[10px] font-semibold uppercase text-accent">
                      today
                    </span>
                  )}
                </Item>
              ))}
            </Command.Group>

            <Command.Group heading="Notes">
              {notes.slice(0, 5).map((n) => (
                <Item
                  key={n.id}
                  value={`note ${n.title} ${n.body.slice(0, 60)}`}
                  onSelect={() => run(() => router.push("/notes"))}
                >
                  <NotebookText className="h-4 w-4 text-muted" />
                  <span className="flex-1 truncate">{n.title}</span>
                  <span className="text-[11px] text-faint">{n.tag}</span>
                </Item>
              ))}
            </Command.Group>

            <Command.Group heading="Goals">
              {goals.map((g) => (
                <Item
                  key={g.id}
                  value={`goal ${g.title}`}
                  onSelect={() => run(() => router.push("/goals"))}
                >
                  <Target className="h-4 w-4 text-muted" />
                  <span className="flex-1 truncate">{g.title}</span>
                  <span className="tabular text-[11px] text-faint">
                    {goalProgress(g)}%
                  </span>
                </Item>
              ))}
            </Command.Group>

            <Command.Group heading="Theme">
              {THEMES.map((t) => (
                <Item
                  key={t.id}
                  value={`theme ${t.name}`}
                  onSelect={() => run(() => setTheme(t.id))}
                >
                  <Palette className="h-4 w-4 text-muted" />
                  <span className="flex-1">
                    Switch to{" "}
                    <span className="font-medium text-text">{t.name}</span>
                  </span>
                  <span className="flex overflow-hidden rounded-full border border-border">
                    {t.swatch.map((c, i) => (
                      <span
                        key={i}
                        className="h-3 w-3"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                </Item>
              ))}
            </Command.Group>
          </Command.List>

          <div className="flex items-center gap-2 sm:gap-3 border-t border-border px-3.5 sm:px-4 py-2 sm:py-2.5 text-[10.5px] sm:text-[11px] text-faint">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> select
            </span>
            <span className="hidden xs:inline">↑↓ navigate</span>
            <span className="ml-auto">esc to close</span>
          </div>
        </Command>
      </motion.div>
    </motion.div>
  );
}

function Item({
  children,
  onSelect,
  value,
  className,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  value?: string;
  className?: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-muted data-[selected=true]:bg-surface-hover data-[selected=true]:text-text",
        className,
      )}
    >
      {children}
    </Command.Item>
  );
}
