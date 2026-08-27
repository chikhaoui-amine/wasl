"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared presentation primitives for the Settings page.
 *
 * One card shape, one header rhythm, one row pattern — the previous settings
 * page mixed four different header styles and three button systems, which is
 * what made it feel messy. Everything here is presentation-only.
 */

export function SettingsSection({
  icon,
  title,
  description,
  aside,
  tone = "default",
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned header slot (badges, master toggles, refresh buttons). */
  aside?: React.ReactNode;
  /** "danger" tints the border for destructive sections. */
  tone?: "default" | "danger";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "card space-y-4 p-5 sm:p-6",
        tone === "danger" && "border-danger/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span
              aria-hidden
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-[10px]",
                tone === "danger" ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent",
              )}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-tight text-text">{title}</h2>
            {description && (
              <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-faint">{description}</p>
            )}
          </div>
        </div>
        {aside && <div className="flex shrink-0 items-center gap-2 pt-0.5">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function SettingsRow({
  label,
  sublabel,
  control,
  className,
}: {
  label: React.ReactNode;
  /** Muted one-liner under the label. */
  sublabel?: React.ReactNode;
  /** Right side: button, toggle, or value. */
  control?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-[12px] border border-border/70 bg-surface-2/40 px-3.5 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-text">{label}</p>
        {sublabel && <p className="mt-0.5 text-[11.5px] leading-relaxed text-faint">{sublabel}</p>}
      </div>
      {control && <div className="flex shrink-0 items-center gap-2">{control}</div>}
    </div>
  );
}

export function SettingsTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      className="flex gap-1.5 overflow-x-auto py-1"
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-surface text-text shadow-sm ring-1 ring-border"
                : "text-faint hover:bg-surface-2 hover:text-muted",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Slim edition status line — replaces the old full-width banner. */
export function EditionBadge({ local: _local = true }: { local?: boolean } = {}) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-faint">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-success"
      />
      <span>Local edition — everything stays on this device.</span>
    </div>
  );
}

/** Consistent inline status messages. */
export function StatusNote({
  tone,
  children,
}: {
  tone: "success" | "error" | "info";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[10px] px-3 py-2 text-[12px] leading-relaxed",
        tone === "success" && "bg-success/10 text-success",
        tone === "error" && "bg-danger/10 text-danger whitespace-pre-wrap",
        tone === "info" && "bg-surface-2 text-muted",
      )}
    >
      {children}
    </p>
  );
}
