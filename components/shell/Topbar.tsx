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
    <header className="topbar-glass sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-base sm:text-lg font-semibold leading-none tracking-tight text-text truncate">
          {title}
        </h1>
        <p className="mt-1 hidden text-[11px] text-faint sm:block">{today}</p>
      </div>

      <button
        onClick={() => setCommandOpen(true)}
        className="hidden items-center gap-2 rounded-[8px] border border-border bg-surface-2/60 px-4 py-2 text-sm text-faint transition-colors hover:bg-surface-hover hover:text-muted sm:flex"
      >
        <Search className="h-4 w-4" />
        <span className="pr-6">Search or jump…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <button
        onClick={() => setTrashOpen(true)}
        aria-label={`Trash, ${trashItems.length} item${trashItems.length === 1 ? "" : "s"}`}
        className="relative rounded-[8px] border border-border bg-surface-2/60 p-1.5 sm:p-2 text-faint hover:text-text hover:bg-surface-hover transition-colors"
        title="Trash & Recovered Items"
      >
        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        {trashItems.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-accent text-[8px] sm:text-[9px] font-bold text-black">
            {trashItems.length}
          </span>
        )}
      </button>

      <ThemeSwitcher />
    </header>
  );
}
