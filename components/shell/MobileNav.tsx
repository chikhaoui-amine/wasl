"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ListChecks,
  Target,
  Repeat,
  Zap,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MobileMenu } from "./MobileMenu";

const items = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/habits", label: "Habits", icon: Repeat },
];

export function MobileNav() {
  const pathname = usePathname();
  const setCaptureOpen = useUI((s) => s.setCaptureOpen);
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 30) {
        setVisible(true);
      } else if (currentScrollY > lastScrollY + 8) {
        setVisible(false);
      } else if (currentScrollY < lastScrollY - 8) {
        setVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+8px)] z-40 flex items-center justify-between gap-1 rounded-[26px] border border-white/10 bg-background/80 px-2 py-1.5 backdrop-blur-xl shadow-2xl md:hidden"
        >
          {items.map((it) => {
            const isActive =
              it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
            const Icon = it.icon;

            return (
              <Link
                key={it.href}
                href={it.href}
                aria-label={it.label}
                title={it.label}
                className="relative flex flex-1 items-center justify-center py-2 transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-pill"
                    className="absolute inset-0 rounded-[20px] bg-accent/15 border border-accent/30"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <motion.div
                  whileTap={{ scale: 0.86 }}
                  className="relative z-10 flex items-center justify-center"
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? "text-accent" : "text-faint hover:text-muted",
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </motion.div>
              </Link>
            );
          })}

          {/* Quick Capture Floating Action Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCaptureOpen(true)}
            aria-label="Quick Capture"
            className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 text-white shadow-lg shadow-orange-500/25 active:shadow-none"
          >
            <Zap className="h-4.5 w-4.5 fill-current" />
          </motion.button>

          {/* More Menu Drawer Trigger */}
          <MobileMenu />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
