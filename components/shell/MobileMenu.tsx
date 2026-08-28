"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  PenLine,
  FileText,
  GraduationCap,
  Activity,
  Wallet,
  Settings,
  Trash2,
  X,
  Grid2x2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUI } from "@/lib/store";
import { useTrashData } from "@/lib/data/domains/trash";

const MORE_MODULES = [
  { href: "/calendar", label: "Calendar", icon: Calendar, color: "text-blue-400 bg-blue-500/10" },
  { href: "/journal", label: "Journal", icon: PenLine, color: "text-amber-400 bg-amber-500/10" },
  { href: "/notes", label: "Notes", icon: FileText, color: "text-purple-400 bg-purple-500/10" },
  { href: "/learning", label: "Learning", icon: GraduationCap, color: "text-emerald-400 bg-emerald-500/10" },
  { href: "/health", label: "Health", icon: Activity, color: "text-rose-400 bg-rose-500/10" },
  { href: "/money", label: "Money", icon: Wallet, color: "text-teal-400 bg-teal-500/10" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const setTrashOpen = useUI((s) => s.setTrashOpen);
  const { items: trashItems } = useTrashData();

  // Escape closes the popover.
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const isMoreActive =
    !["/", "/tasks", "/goals", "/habits"].some(
      (path) => (path === "/" ? pathname === "/" : pathname.startsWith(path)),
    );

  return (
    <>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="More modules"
        title="More"
        className="relative flex flex-1 flex-col items-center justify-center py-1 transition-colors"
      >
        {(isMoreActive || open) && (
          <motion.div
            layoutId="mobile-nav-indicator"
            className="absolute inset-x-1.5 inset-y-0.5 rounded-[16px] bg-accent/15 border border-accent/30 shadow-[0_0_12px_rgba(var(--accent-rgb),0.12)]"
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
          />
        )}
        <motion.div
          whileTap={{ scale: 0.88 }}
          className="relative z-10 flex flex-col items-center gap-0.5"
        >
          <Grid2x2
            className={cn(
              "h-[19px] w-[19px] transition-colors",
              isMoreActive || open ? "text-accent" : "text-faint hover:text-muted",
            )}
            strokeWidth={isMoreActive || open ? 2.4 : 1.9}
          />
          <span
            className={cn(
              "text-[9.5px] font-bold tracking-tight transition-colors leading-none",
              isMoreActive || open ? "text-accent" : "text-faint",
            )}
          >
            More
          </span>
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
              onClick={() => setOpen(false)}
            />

            {/* Floating Island Popover */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="More navigation modules"
              initial={{ opacity: 0, y: 14, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed bottom-[68px] left-3.5 right-3.5 z-50 mx-auto max-w-md rounded-[26px] border border-white/15 dark:border-white/10 bg-surface/95 p-3.5 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.45),0_2px_12px_rgba(0,0,0,0.25)] md:hidden"
              style={{ marginBottom: "max(env(safe-area-inset-bottom), 0px)" }}
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-border/50 pb-2 px-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-faint">
                  More Modules
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setOpen(false);
                      setTrashOpen(true);
                    }}
                    aria-label="Trash"
                    className="relative grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-faint hover:text-text hover:bg-surface-hover transition-colors"
                    title="Trash & Recovered Items"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {trashItems.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-black">
                        {trashItems.length}
                      </span>
                    )}
                  </button>

                  <Link
                    href="/settings"
                    onClick={() => setOpen(false)}
                    aria-label="Settings"
                    className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-faint hover:text-text hover:bg-surface-hover transition-colors"
                    title="Settings"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-faint hover:text-text hover:bg-surface-hover transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 3x2 Modules Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2.5">
                {MORE_MODULES.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex flex-col items-center justify-center gap-1.5 rounded-[16px] border p-2.5 text-center transition-all",
                        active
                          ? "border-accent/40 bg-accent-soft/30 text-accent shadow-xs"
                          : "border-border/60 bg-surface-2/50 text-text hover:border-border hover:bg-surface-2/90 active:scale-95",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-8.5 w-8.5 place-items-center rounded-full transition-transform group-hover:scale-105",
                          item.color,
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                      </span>
                      <span className="text-[11px] font-semibold tracking-tight truncate w-full">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
