"use client";

import { useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Pencil,
  PenLine,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  List,
} from "lucide-react";
import {
  useJournalData,
  moodDistribution,
  MOOD_META,
  MOOD_ORDER,
  getMoodMeta,
  type JournalEntry,
  type Mood,
} from "@/lib/data/domains/journal";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { Modal, Field, FormFooter, inputCls } from "@/components/ui/Modal";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { applyEditorFormatting } from "@/lib/editor-formatting";
import { Hydrate } from "@/lib/hydration";
import { fromISO, relLabel, todayISO, toISO } from "@/lib/date";
import { cn } from "@/lib/utils";

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: { iso: string; dayNum: number; inMonth: boolean }[] = [];

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i);
    days.push({ iso: toISO(d), dayNum: prevMonthDays - i, inMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    days.push({ iso: toISO(dateObj), dayNum: d, inMonth: true });
  }

  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ iso: toISO(d), dayNum: i, inMonth: false });
  }

  return days;
}

export default function JournalPage() {
  const { entries, addEntry } = useJournalData();
  const today = todayISO();
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const initialDateObj = fromISO(today);
  const [calendarYear, setCalendarYear] = useState(initialDateObj.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(initialDateObj.getMonth());

  const [mood, setMood] = useState<Mood>("good");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<JournalEntry | undefined>();
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);

  const dist = moodDistribution(entries);
  const maxDist = Math.max(...MOOD_ORDER.map((m) => dist[m]), 1);

  // Map entries by date for fast lookup in calendar
  const entriesByDate = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const list = entriesByDate.get(e.date) ?? [];
    list.push(e);
    entriesByDate.set(e.date, list);
  }

  const selectedEntries = entriesByDate.get(selectedDate) ?? [];

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    setSelectedDate(today);
  };

  const applyFormat = (prefix: string, suffix: string = "") => {
    const textarea = composerTextareaRef.current;
    const { newText, selectionStart, selectionEnd } = applyEditorFormatting(
      textarea,
      body,
      prefix,
      suffix,
    );
    setBody(newText);
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  };

  const save = () => {
    if (!body.trim()) return;
    addEntry(mood, body.trim(), selectedDate);
    setBody("");
  };

  const monthName = new Date(calendarYear, calendarMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const monthDays = getMonthDays(calendarYear, calendarMonth);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Hydrate>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Main Column: Journal Writing & Selected Date Entries */}
        <div className="space-y-5 lg:col-span-2">
          <Card className="bg-[linear-gradient(165deg,var(--accent-soft),transparent_45%)] p-3.5 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-display text-base sm:text-xl font-bold tracking-tight text-text flex items-center gap-2">
                  <span>{relLabel(selectedDate)}</span>
                  {selectedDate === today && (
                    <span className="rounded-pill bg-accent/20 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                      Today
                    </span>
                  )}
                </h3>
                <p className="text-[12px] sm:text-[13px] text-faint">
                  {fromISO(selectedDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              {selectedEntries.length > 0 && (
                <span className="rounded-pill bg-surface-2 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-[12px] font-semibold text-muted">
                  {selectedEntries.length} {selectedEntries.length === 1 ? "entry" : "entries"}
                </span>
              )}
            </div>

            {/* Display Entries for Selected Date */}
            {selectedEntries.length > 0 && (
              <div className="space-y-3">
                {selectedEntries.map((e) => {
                  const moodMeta = getMoodMeta(e.mood);
                  const MoodIcon = moodMeta.icon;
                  return (
                    <Card key={e.id} hover className="group p-3 sm:p-4 border border-border/80 bg-surface">
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 sm:px-2.5 text-[11px] sm:text-[12px] font-medium"
                          style={{
                            background: `color-mix(in oklab, ${moodMeta.color} 14%, transparent)`,
                            color: moodMeta.color,
                          }}
                        >
                          <MoodIcon className="h-3.5 w-3.5" /> {moodMeta.label}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular text-[11px] sm:text-[12px] text-faint">
                            {new Date(e.createdAt).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </span>
                          <button
                            onClick={() => setEditing(e)}
                            aria-label="Edit entry"
                            className="grid h-6 w-6 place-items-center rounded-md text-faint opacity-70 transition-opacity hover:bg-surface-2 hover:text-muted sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </div>
                      <MarkdownRenderer content={e.body} className="text-[13px] sm:text-[14px]" />
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Inline Writer for Selected Date */}
            <div className="space-y-3.5 sm:space-y-4 pt-1 sm:pt-2">
              <SectionTitle>
                {selectedEntries.length > 0 ? "Add another entry" : "Write journal entry"}
              </SectionTitle>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {MOOD_ORDER.map((m) => {
                  const MoodIcon = MOOD_META[m].icon;
                  return (
                    <button
                      key={m}
                      onClick={() => setMood(m)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-pill border px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[12px] sm:text-[13px] font-medium transition-all",
                        mood === m
                          ? "border-transparent bg-accent-soft text-accent shadow-sm"
                          : "border-border text-muted hover:bg-surface-hover",
                      )}
                    >
                      <MoodIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: MOOD_META[m].color }} />
                      {MOOD_META[m].label}
                    </button>
                  );
                })}
              </div>

              {/* Formatting Toolbar with Quick Headers */}
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-surface-2/60 p-1 sm:p-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => applyFormat("# ")}
                  title="Heading 1 (#)"
                  className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-md font-bold text-muted hover:bg-surface-hover hover:text-text transition-colors"
                >
                  <Heading1 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("## ")}
                  title="Heading 2 (##)"
                  className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-md font-semibold text-muted hover:bg-surface-hover hover:text-text transition-colors"
                >
                  <Heading2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("### ")}
                  title="Heading 3 (###)"
                  className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text transition-colors"
                >
                  <Heading3 className="h-3.5 w-3.5" />
                </button>

                <div className="h-4 w-px bg-border/80 mx-0.5" />

                <button
                  type="button"
                  onClick={() => applyFormat("**", "**")}
                  title="Bold (**text**)"
                  className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text transition-colors"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("- ")}
                  title="Bulleted List (- item)"
                  className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text transition-colors"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>

              <textarea
                ref={composerTextareaRef}
                dir="auto"
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={`What happened on ${relLabel(selectedDate).toLowerCase()}? Write your thoughts…`}
                className="w-full min-h-[160px] sm:min-h-[260px] resize-y rounded-[14px] sm:rounded-[16px] bg-surface-2 px-3.5 py-3 sm:px-4 sm:py-3.5 text-[14px] sm:text-[16px] leading-relaxed text-text outline-none focus:ring-2 focus:ring-accent/40 placeholder:text-faint transition-all"
              />
              <div className="flex justify-end">
                <button
                  onClick={save}
                  disabled={!body.trim()}
                  className="btn-hero flex items-center gap-2 rounded-full px-4 py-2 sm:px-5 sm:py-2.5 text-[13px] sm:text-[14px] font-semibold disabled:opacity-40"
                >
                  <PenLine className="h-4 w-4" /> Save entry
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Side Section: Mood & Calendar */}
        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle>Mood · last 2 weeks</SectionTitle>
            <div className="space-y-2">
              {MOOD_ORDER.map((m) => {
                const MoodIcon = MOOD_META[m].icon;
                return (
                  <div key={m} className="flex items-center gap-2 text-[12px]">
                    <span className="flex w-16 shrink-0 items-center gap-1 text-muted">
                      <MoodIcon className="h-3 w-3" style={{ color: MOOD_META[m].color }} />
                      {MOOD_META[m].label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-2">
                      <div
                        className="h-full rounded-pill"
                        style={{ width: `${(dist[m] / maxDist) * 100}%`, background: MOOD_META[m].color }}
                      />
                    </div>
                    <span className="tabular w-4 shrink-0 text-right text-faint">{dist[m]}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Calendar Card (Moved to Sidebar) */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-accent" />
                <h2 className="font-display text-sm font-semibold text-text">{monthName}</h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleGoToToday}
                  className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted hover:bg-surface-hover hover:text-text transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                  className="grid h-6 w-6 place-items-center rounded-lg bg-surface-2 text-muted hover:bg-surface-hover hover:text-text transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleNextMonth}
                  aria-label="Next month"
                  className="grid h-6 w-6 place-items-center rounded-lg bg-surface-2 text-muted hover:bg-surface-hover hover:text-text transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Calendar Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1 text-center">
              {weekDays.map((wd) => (
                <div key={wd} className="py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-faint">
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((d) => {
                const isSelected = d.iso === selectedDate;
                const isToday = d.iso === today;
                const dayLogs = entriesByDate.get(d.iso) ?? [];
                const hasLogs = dayLogs.length > 0;

                return (
                  <button
                    key={d.iso}
                    onClick={() => setSelectedDate(d.iso)}
                    className={cn(
                      "group relative flex min-h-[38px] flex-col items-center justify-between rounded-lg p-1 transition-all text-left",
                      isSelected
                        ? "bg-accent/15 border-2 border-accent text-accent shadow-sm"
                        : "border border-border/40 bg-surface-2/40 hover:bg-surface-hover",
                      !d.inMonth && "opacity-35",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px] font-semibold leading-none",
                        isSelected ? "text-accent" : isToday ? "text-text font-bold" : "text-muted",
                      )}
                    >
                      {d.dayNum}
                    </span>

                    {/* Entry Indicators / Mood Dots */}
                    <div className="flex flex-wrap items-center justify-center gap-0.5 mt-0.5">
                      {hasLogs ? (
                        dayLogs.slice(0, 3).map((e, idx) => {
                          const moodMeta = getMoodMeta(e.mood);
                          const MoodIcon = moodMeta.icon;
                          return (
                            <span key={idx} title={`${moodMeta.label} entry`}>
                              <MoodIcon
                                className="h-2.5 w-2.5"
                                style={{ color: moodMeta.color }}
                              />
                            </span>
                          );
                        })
                      ) : isToday ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <EditEntryModal key={editing?.id ?? "none"} entry={editing} onClose={() => setEditing(undefined)} />
    </Hydrate>
  );
}

function EditEntryModal({ entry, onClose }: { entry?: JournalEntry; onClose: () => void }) {
  const { updateEntry, deleteEntry } = useJournalData();
  const [mood, setMood] = useState<Mood>(entry?.mood ?? "good");
  const [body, setBody] = useState(entry?.body ?? "");
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (prefix: string, suffix: string = "") => {
    const textarea = editTextareaRef.current;
    const { newText, selectionStart, selectionEnd } = applyEditorFormatting(
      textarea,
      body,
      prefix,
      suffix,
    );
    setBody(newText);
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry || !body.trim()) return;
    updateEntry(entry.id, { mood, body: body.trim() });
    onClose();
  };

  return (
    <Modal open={!!entry} onClose={onClose} title="Edit entry" wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {MOOD_ORDER.map((m) => {
            const MoodIcon = MOOD_META[m].icon;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                className={cn(
                  "flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  mood === m
                    ? "border-transparent bg-accent-soft text-accent"
                    : "border-border text-muted hover:bg-surface-hover",
                )}
              >
                <MoodIcon className="h-3.5 w-3.5" style={{ color: MOOD_META[m].color }} />
                {MOOD_META[m].label}
              </button>
            );
          })}
        </div>

        {/* Formatting Toolbar */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-surface-2/60 p-1.5 text-xs">
          <button
            type="button"
            onClick={() => applyFormat("# ")}
            title="Heading 1 (#)"
            className="flex h-7 w-7 items-center justify-center rounded-md font-bold text-muted hover:bg-surface-hover hover:text-text transition-colors"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat("## ")}
            title="Heading 2 (##)"
            className="flex h-7 w-7 items-center justify-center rounded-md font-semibold text-muted hover:bg-surface-hover hover:text-text transition-colors"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat("### ")}
            title="Heading 3 (###)"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text transition-colors"
          >
            <Heading3 className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-px bg-border/80 mx-0.5" />

          <button
            type="button"
            onClick={() => applyFormat("**", "**")}
            title="Bold (**text**)"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text transition-colors"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat("- ")}
            title="Bulleted List (- item)"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-text transition-colors"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

        <Field label="Entry">
          <textarea
            ref={editTextareaRef}
            rows={5}
            dir="auto"
            className={`${inputCls} resize-y font-normal`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        <FormFooter
          submitLabel="Save changes"
          disabled={!body.trim()}
          onDelete={
            entry
              ? () => {
                  deleteEntry(entry.id);
                  onClose();
                }
              : undefined
          }
        />
      </form>
    </Modal>
  );
}

