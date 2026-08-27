"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";
import { WaslLogo } from "@/components/ui/WaslLogo";

export function Sidebar() {
  const pathname = usePathname();
  const navGroups = NAV;

  return (
    <aside className="rail sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-2 border-r px-3 py-4 md:flex xl:static xl:h-auto xl:rounded-[18px] xl:border">
      {/* Sidebar Brand Header */}
      <div className="flex flex-col gap-3 px-1 pt-1 pb-1">
        <Link
          href="/"
          /* Tweak `pl-[14px]` to move both logo & text left/right, tweak `gap-3` to change distance between logo & text */
          className="group flex items-center gap-3 pl-[14px] pr-2 py-1 transition-transform active:scale-[0.98]"
        >
          <WaslLogo className="h-11 w-11 shrink-0 text-[var(--rail-logo-color)] transition-transform duration-200 group-hover:scale-105" />
          {/* Tweak `ml-[0px]` or `translate-x-[0px]` on the span below to nudge just the WASL word */}
          <span className="ml-[10px] font-sans text-[32px] font-black leading-none tracking-tight text-[var(--rail-text)] transition-opacity group-hover:opacity-90">
            WASL
          </span>
        </Link>
        <div className="h-px w-full bg-[var(--rail-border)] opacity-80" />
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto pb-4">
        {navGroups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-1">
            {group.label && (
              <div className="rail-label mb-1.5 px-3.5 text-[10.5px] font-bold uppercase tracking-[0.2em]">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active}
                  className="rail-item group relative flex items-center gap-3.5 rounded-[10px] px-3.5 py-2.5 text-[15px]"
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-[2.5px] -translate-y-1/2 rounded-r-full bg-accent" />
                  )}
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 2.2} />
                  <span className="flex-1 font-semibold text-[15px] tracking-[-0.01em]">{item.label}</span>
                  {item.status === "soon" && (
                    <span className="rounded-pill bg-[var(--rail-hover)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--rail-faint)]">
                      soon
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
