"use client";

import { useEffect } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Grid2x2, X } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { WaslLogo } from "@/components/ui/WaslLogo";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const visibleGroups = NAV;

  // Escape closes the drawer.
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="More pages"
        title="More pages"
        className="flex flex-1 items-center justify-center py-2 text-faint transition-colors hover:text-muted"
      >
        <Grid2x2 className="h-5 w-5" strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="card-glass absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[24px] p-4"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-accent-soft text-logo">
                    <WaslLogo className="h-4 w-4" />
                  </div>
                  <span className="font-display text-sm font-bold tracking-tight text-text">
                    WASL
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-1.5 text-faint hover:bg-surface-hover"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                {visibleGroups.map((group, gi) => (
                  <div key={gi}>
                    {group.label && (
                      <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
                        {group.label}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active =
                          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[13px] font-medium",
                              active ? "bg-accent-soft text-accent" : "text-text hover:bg-surface-hover",
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
