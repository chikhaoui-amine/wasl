"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Palette } from "lucide-react";
import { THEMES } from "@/lib/themes";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ThemeSwitcher() {
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change theme"
        className="grid h-9 w-9 place-items-center rounded-[10px] border border-border text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        <Palette className="h-[18px] w-[18px]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-11 z-50 w-60 origin-top-right rounded-card border border-border bg-surface p-1.5 shadow-lg"
            style={{ boxShadow: "var(--shadow-lg, 0 20px 50px rgba(0,0,0,.35))" }}
          >
            <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
              Theme
            </div>
            {THEMES.map((t) => {
              const active = t.id === theme;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors",
                    active ? "bg-accent-soft" : "hover:bg-surface-hover",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-border-strong">
                    {t.swatch.map((c, i) => (
                      <span key={i} className="h-full flex-1" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-medium", active ? "text-accent" : "text-text")}>
                      {t.name}
                    </span>
                    <span className="block text-[11px] text-faint">{t.tagline}</span>
                  </span>
                  {active && <Check className="h-4 w-4 text-accent" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
