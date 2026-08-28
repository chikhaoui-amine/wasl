"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { getIconComponent, type IconKey } from "@/lib/icons";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal(props: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full";
  preventBackdropClose?: boolean;
  dirty?: boolean;
  confirmDiscardMessage?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe portal mount
    setMounted(true);
  }, []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {props.open && <ModalInner {...props} />}
    </AnimatePresence>,
    document.body,
  );
}

function ModalInner({
  onClose,
  title,
  children,
  wide,
  size,
  preventBackdropClose,
  dirty,
  confirmDiscardMessage,
}: Omit<Parameters<typeof Modal>[0], "open">) {
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Latest-value refs so once-bound listeners always see current props/state.
  const dirtyRef = useRef(dirty);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    dirtyRef.current = dirty;
    onCloseRef.current = onClose;
  }, [dirty, onClose]);

  const handleAttemptClose = () => {
    if (dirtyRef.current) {
      setShowConfirmDiscard(true);
    } else {
      onCloseRef.current();
    }
  };

  // Escape closes the modal; the dependency array is intentional — handlers
  // read latest state via refs/closures recreated per render but we only want
  // ONE listener bound for the modal's lifetime.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleAttemptClose();
      }
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bind once per open modal
  }, []);

  // Focus management: remember the trigger, focus the dialog on open, restore
  // focus to the trigger on close.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const dialogEl = dialogRef.current;
    if (dialogEl) {
      const first = dialogEl.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? dialogEl).focus();
    }

    const previouslyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previouslyOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, []);

  // Tab cycling (focus trap)
  useEffect(() => {
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const dialogEl = dialogRef.current;
      if (!dialogEl) return;
      const focusable = Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, []);

  const sizeMap: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    full: "max-w-full",
  };

  const widthClass = size
    ? (sizeMap[size] ?? "max-w-md")
    : wide
    ? "max-w-2xl"
    : "max-w-md";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2.5 pt-[2vh] sm:p-4 sm:pt-[6vh] backdrop-blur-md"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      onClick={() => {
        if (!preventBackdropClose) {
          handleAttemptClose();
        }
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        initial={{ opacity: 0, y: -10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${widthClass} card-glass rounded-[20px] sm:rounded-[24px] shadow-float relative outline-none`}
      >
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5 sm:px-5 sm:py-3.5">
          <h2 className="font-display text-[14.5px] sm:text-[16px] font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={handleAttemptClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-hover hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3.5 sm:p-5">{children}</div>

        {/* Unsaved Changes Safety Confirmation Overlay */}
        {showConfirmDiscard && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-[70] flex items-center justify-center rounded-[20px] sm:rounded-[24px] bg-surface-1/95 p-6 backdrop-blur-md animate-in fade-in duration-150"
          >
            <div className="max-w-sm text-center space-y-4">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger/15 text-danger font-bold">
                <X className="h-6 w-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-text">Discard unsaved changes?</h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  {confirmDiscardMessage || "You have unsaved edits. If you close now, your progress will be lost."}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmDiscard(false)}
                  className="rounded-xl border border-border bg-surface-2 px-4 py-2 text-xs font-semibold text-text hover:bg-surface-hover transition-colors"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmDiscard(false);
                    onClose();
                  }}
                  className="rounded-xl bg-danger px-4 py-2 text-xs font-semibold text-white hover:bg-danger/90 transition-colors shadow-sm"
                >
                  Discard & Close
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ---------- shared form primitives ---------- */

export function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] sm:text-[12px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-[10px] sm:rounded-[12px] border border-border bg-surface-2 px-3 py-2 sm:px-3.5 sm:py-2.5 text-[13px] sm:text-[14px] text-text outline-none placeholder:text-faint focus:border-border-strong";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-0.5 rounded-[12px] bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[9px] px-2 py-1.5 text-[12px] font-medium transition-colors ${
            value === o.value ? "bg-surface text-text shadow-sm" : "text-faint hover:text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ColorDots({
  value,
  onChange,
  colors,
}: {
  value: string;
  onChange: (c: string) => void;
  colors: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          className="grid h-7 w-7 place-items-center rounded-full transition-transform hover:scale-110"
          style={{ background: c, outline: value === c ? `2px solid var(--ring)` : "none", outlineOffset: 2 }}
        />
      ))}
    </div>
  );
}

export function IconPicker({
  value,
  onChange,
  icons,
  accent,
}: {
  value: IconKey;
  onChange: (key: IconKey) => void;
  icons: IconKey[];
  /** tint the selected swatch this color instead of the default accent */
  accent?: string;
}) {
  return (
    <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-[12px] border border-border/40 bg-surface-2/40 p-2">
      {icons.map((key) => {
        const Icon = getIconComponent(key);
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-label={key.replace(/-/g, " ")}
            aria-pressed={active}
            className="grid h-9 w-9 place-items-center rounded-[10px] transition-all hover:scale-105"
            style={{
              background: active ? `${accent ?? "var(--accent)"}22` : "var(--surface-2)",
              color: active ? (accent ?? "var(--accent)") : "var(--faint)",
              outline: active ? `2px solid ${accent ?? "var(--ring)"}` : "none",
              outlineOffset: 1,
            }}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

export function FormFooter({
  onDelete,
  onCancel,
  submitLabel,
  disabled,
}: {
  onDelete?: () => void;
  onCancel?: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-5 flex items-center justify-between">
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="rounded-[10px] px-3 py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger/10"
        >
          Delete
        </button>
      ) : onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[10px] px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          Cancel
        </button>
      ) : (
        <span />
      )}
      <button
        type="submit"
        disabled={disabled}
        className="btn-hero rounded-[12px] px-4 py-2 text-[13px] font-semibold disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </div>
  );
}
