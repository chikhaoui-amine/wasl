"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ListChecks,
  Target,
  Repeat,
} from "lucide-react";
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

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-3 left-3.5 right-3.5 z-40 mx-auto flex max-w-md items-center justify-around rounded-[24px] border border-white/15 dark:border-white/10 bg-surface/85 p-1.5 backdrop-blur-2xl shadow-[0_10px_36px_rgba(0,0,0,0.35),0_1px_2px_rgba(0,0,0,0.15)] md:hidden"
      style={{ marginBottom: "max(env(safe-area-inset-bottom), 0px)" }}
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
            className="relative flex flex-1 flex-col items-center justify-center py-1 transition-colors"
          >
            {isActive && (
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
              <Icon
                className={cn(
                  "h-[19px] w-[19px] transition-colors",
                  isActive ? "text-accent" : "text-faint hover:text-muted",
                )}
                strokeWidth={isActive ? 2.4 : 1.9}
              />
              <span
                className={cn(
                  "text-[9.5px] font-bold tracking-tight transition-colors leading-none",
                  isActive ? "text-accent" : "text-faint",
                )}
              >
                {it.label}
              </span>
            </motion.div>
          </Link>
        );
      })}

      {/* More Menu Drawer Trigger */}
      <MobileMenu />
    </nav>
  );
}
