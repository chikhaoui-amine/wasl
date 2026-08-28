"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { useUI } from "@/lib/store";
import { useTrashData } from "@/lib/data/domains/trash";
import { Kbd } from "@/components/ui/primitives";
import { ThemeSwitcher } from "./ThemeSwitcher";

const noopSubscribe = () => () => {};

function getClientDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function useTitle() {
  const pathname = usePathname();
  if (pathname === "/") return "Home";
  const match = ALL_NAV_ITEMS.find(
    (i) => i.href !== "/" && pathname.startsWith(i.href),
  );
  return match?.label ?? "WASL";
}

export function Topbar() {
  const title = useTitle();
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const setTrashOpen = useUI((s) => s.setTrashOpen);
  const { items: trashItems } = useTrashData();

  // Post-hydration only: rendering a fresh Date during prerender mismatches
  // the client (build-machine date ≠ user's timezone/midnight).
  const today = useSyncExternalStore(noopSubscribe, getClientDate, () => null);

  return (
    <header className="topbar-glass sticky top-0 z-30 flex h-12.5 sm:h-16 items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[15px] sm:text-lg font-semibold leading-none tracking-tight text-text truncate">
          {title}
        </h1>
        <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-faint truncate">
          <span className="sm:hidden">{today ? today.split(",")[0] : ""}</span>
          <span className="hidden sm:inline">{today}</span>
        </p>
      </div>

      {/* Mobile Search Button */}
      <button
        onClick={() => setCommandOpen(true)}
        aria-label="Search or jump"
        className="flex sm:hidden h-8 w-8 items-center justify-center rounded-[9px] border border-border bg-surface-2/60 text-faint hover:text-text hover:bg-surface-hover transition-colors shrink-0"
        title="Search"
      >
        <Search className="h-3.5 w-3.5" />
      </button>

      {/* Desktop Search Bar */}
      <button
        onClick={() => setCommandOpen(true)}
        className="hidden items-center gap-2 rounded-[10px] border border-border bg-surface-2/60 px-3.5 py-1.5 text-xs text-faint transition-colors hover:bg-surface-hover hover:text-muted sm:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="pr-4">Search or jump…</span>
        <Kbd>⌘K</Kbd>
      </button>

      {/* Desktop Trash Button (On mobile, Trash is in the More popover) */}
      <button
        onClick={() => setTrashOpen(true)}
        aria-label={`Trash, ${trashItems.length} item${trashItems.length === 1 ? "" : "s"}`}
        className="hidden sm:flex relative h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-2/60 text-faint hover:text-text hover:bg-surface-hover transition-colors shrink-0"
        title="Trash & Recovered Items"
      >
        <Trash2 className="h-4 w-4" />
        {trashItems.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-black">
            {trashItems.length}
          </span>
        )}
      </button>

      <ThemeSwitcher />
    </header>
  );
}
