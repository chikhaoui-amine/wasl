"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ShieldCheck,
  HardDrive,
  Cpu,
  ArrowRight,
  Check,
  Lock,
  Layers,
  AlertTriangle,
  FileText,
  Activity,
  Calendar,
  Compass,
  Zap,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";

export const ONBOARDING_STORAGE_KEY = "wasl_onboarding_completed";

interface LocalOnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

const MCP_EXAMPLES = [
  {
    icon: Calendar,
    text: "“Plan my day from my active goals, unfinished tasks and schedule.”",
  },
  {
    icon: FileText,
    text: "“Read this messy note, extract the actions, create the tasks and organize them.”",
  },
  {
    icon: Activity,
    text: "“Review my last month across habits, journal, health, goals and spending. Find patterns I probably missed.”",
  },
  {
    icon: Compass,
    text: "“I want to learn machine learning. Look at my goals, learning notes and available time and build a realistic plan inside WASL.”",
  },
  {
    icon: Zap,
    text: "“Turn this research into a note, extract the useful opportunities and create follow-up tasks.”",
  },
  {
    icon: Layers,
    text: "“Look at everything currently competing for my attention and tell me what I should stop, continue or prioritize.”",
  },
  {
    icon: FileText,
    text: "“Prepare my weekly review using what actually happened in WASL instead of what I remember happening.”",
  },
  {
    icon: Sparkles,
    text: "“Create tomorrow's focus from my priorities and unfinished commitments.”",
  },
];

const CONNECTION_CHAINS = [
  {
    chain: "Goal → today's task → scheduled time → completion → review",
    label: "Execution loop",
  },
  {
    chain: "Habit → history → weekly reflection",
    label: "Consistency",
  },
  {
    chain: "Note → AI → actionable tasks",
    label: "Synthesis",
  },
  {
    chain: "Health + journal + habits → patterns over time",
    label: "Holistic insights",
  },
];

export function LocalOnboardingModal({ open, onClose }: LocalOnboardingModalProps) {
  const router = useRouter();
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch {}
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleDismiss]);

  const handleOpenMcpSettings = () => {
    handleDismiss();
    router.push("/settings");
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-5 md:p-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            ref={dialogRef}
            className="relative my-auto flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-border/80 bg-surface shadow-2xl"
            style={{ boxShadow: "0 25px 60px -15px rgba(0,0,0,0.5), 0 0 0 1px var(--border)" }}
          >
            {/* Ambient background glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full opacity-15 blur-3xl"
              style={{ background: "var(--accent)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full opacity-10 blur-3xl"
              style={{ background: "var(--hero-fg, var(--accent))" }}
            />

            {/* Scrollable Body */}
            <div className="relative z-10 space-y-8 overflow-y-auto p-5 sm:p-7 md:p-9 text-text">
              
              {/* 1. Welcome to WASL */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                    <Sparkles className="h-3.5 w-3.5" />
                    Welcome to WASL Local
                  </span>
                </div>
                
                <h1
                  id="onboarding-modal-title"
                  className="font-display text-[26px] sm:text-[32px] md:text-[38px] font-bold tracking-tight text-text"
                >
                  Your life, connected.
                </h1>

                <p className="max-w-2xl text-[14px] sm:text-[15px] leading-relaxed text-muted">
                  WASL is a personal operating system where goals, tasks, focus, time, habits, notes, journal, health, money, learning and reviews live in one connected place instead of separate apps and isolated lists. WASL becomes more useful as you record your real life in it because different areas can provide context to each other.
                </p>
              </section>

              {/* 2. Choose your theme / Visual style */}
              <section className="space-y-3.5 rounded-[18px] border border-border/70 bg-surface-2/40 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h2 className="text-[13.5px] font-semibold text-text">
                      Choose your visual style
                    </h2>
                    <p className="text-[12px] text-faint">
                      Select a theme to personalize WASL. You can always change this later.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                  {THEMES.map((t) => {
                    const active = t.id === theme;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={cn(
                          "group relative flex flex-col items-start gap-2 rounded-[14px] border p-2.5 text-left transition-all",
                          active
                            ? "border-accent bg-accent-soft shadow-sm ring-1 ring-accent"
                            : "border-border/60 bg-surface hover:border-border hover:bg-surface-hover",
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="flex h-6 w-12 overflow-hidden rounded-[6px] border border-border-strong">
                            {t.swatch.map((c, i) => (
                              <span key={i} className="h-full flex-1" style={{ background: c }} />
                            ))}
                          </span>
                          {active && (
                            <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-accent text-bg">
                              <Check className="h-3 w-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-[12.5px] font-medium leading-tight", active ? "text-accent" : "text-text")}>
                            {t.name}
                          </p>
                          <p className="truncate text-[10.5px] text-faint">{t.tagline}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 3. Your data stays with you */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-faint">
                  <HardDrive className="h-3.5 w-3.5 text-accent" />
                  Data Ownership & Storage
                </div>

                <div className="space-y-3">
                  <h2 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-text">
                    Your data stays with you
                  </h2>
                  <p className="text-[13.5px] leading-relaxed text-muted">
                    In Local Edition, there is <strong>no WASL cloud account required</strong>. Your entire system is stored directly on your device inside this browser&apos;s <strong>IndexedDB storage (<code className="font-mono text-[12px] text-text">wasl-local</code>)</strong>. WASL does not automatically upload or sync a cloud copy of your information.
                  </p>
                </div>

                {/* Prominent Backup Warning Box */}
                <div className="rounded-[16px] border border-warn/35 bg-warn/10 p-4 sm:p-5">
                  <div className="flex items-start gap-3.5">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-warn/20 text-warn">
                      <AlertTriangle className="h-4.5 w-4.5" />
                    </div>
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-text">
                        Your local data is your responsibility — create backups.
                      </p>
                      <p className="text-[12.5px] leading-relaxed text-muted">
                        Clearing your browser cache or site data, resetting your profile, or switching devices may permanently delete your local database. Protect your data by downloading verified <code className="font-mono text-[11.5px] text-text">.wasl-backup</code> snapshots from <strong>Settings → Backup &amp; transfer</strong> before clearing browser data or changing devices.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 4. Why WASL is useful */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-faint">
                  <Layers className="h-3.5 w-3.5 text-accent" />
                  Connected System
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-text">
                    Why WASL is useful
                  </h2>
                  <p className="text-[13.5px] leading-relaxed text-muted">
                    WASL is not valuable because it has many trackers; it is valuable because they form <strong>one context-rich system</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {CONNECTION_CHAINS.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col justify-between rounded-[14px] border border-border/70 bg-surface-2/40 p-3.5 transition-colors hover:border-border hover:bg-surface-2/70"
                    >
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                        {item.label}
                      </span>
                      <p className="mt-1 font-mono text-[12px] leading-relaxed text-text font-medium">
                        {item.chain}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. AI that understands your actual system — MCP */}
              <section className="space-y-4 rounded-[18px] border border-accent/25 bg-accent-soft/30 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
                  <Cpu className="h-3.5 w-3.5" />
                  AI Native
                </div>

                <div className="space-y-2">
                  <h2 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-text">
                    AI that understands your actual system — MCP
                  </h2>
                  <p className="text-[13.5px] sm:text-[14px] leading-relaxed text-text">
                    <strong>MCP lets compatible AI assistants use WASL as tools. Instead of copying your notes, goals and tasks into a chat, you can give an AI controlled access to your actual WASL system.</strong>
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-[12.5px] leading-relaxed text-muted">
                  <div className="rounded-[12px] border border-border/60 bg-surface/80 p-3 space-y-1">
                    <p className="font-semibold text-text flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-accent" />
                      Granular Permission Control
                    </p>
                    <p>
                      <strong>Read-only:</strong> AI can understand selected WASL information without changing it.
                    </p>
                    <p>
                      <strong>Read + write:</strong> AI can create or update items when you explicitly want it to act.
                    </p>
                  </div>

                  <div className="rounded-[12px] border border-border/60 bg-surface/80 p-3 space-y-1">
                    <p className="font-semibold text-text flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-success" />
                      Local &amp; Secure
                    </p>
                    <p>
                      Works with compatible clients like <strong>Claude, Codex, Cursor, VS Code, Hermes, Windsurf</strong> and others.
                    </p>
                    <p>
                      In Local Edition, the connector runs via a local authenticated loopback bridge while WASL is open. It never grants unrestricted computer access.
                    </p>
                  </div>
                </div>

                {/* What can I actually do with this? */}
                <div className="space-y-2.5 pt-1">
                  <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-faint">
                    What can I actually do with this?
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {MCP_EXAMPLES.map((ex, i) => {
                      const Icon = ex.icon;
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 rounded-[12px] border border-border/50 bg-surface/90 p-2.5 text-[12px] text-muted shadow-sm"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                          <span className="leading-snug text-text/90 italic">{ex.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleOpenMcpSettings}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:underline cursor-pointer"
                  >
                    Learn how to connect MCP <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </section>

              {/* 6. Final CTA */}
              <section className="space-y-4 pt-2">
                <div className="rounded-[16px] border border-border/70 bg-surface-2/30 p-4 sm:p-5 text-center">
                  <p className="text-[13.5px] font-medium text-text">
                    WASL works best when it reflects your real life. Start simple and let the system grow with you.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="btn-hero w-full sm:w-auto flex items-center justify-center gap-2 rounded-[14px] px-7 py-3 text-[14px] font-semibold cursor-pointer shadow-lg transition-transform active:scale-95"
                  >
                    <span>I understand — enter WASL</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </section>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
