import {
  LayoutDashboard,
  Target,
  ListChecks,
  CalendarDays,
  NotebookText,
  GraduationCap,
  PenLine,
  Repeat,
  HeartPulse,
  Wallet,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** live = built now (Phase 1); soon = shown but coming later. */
  status: "live" | "soon";
  /** one-line purpose, shown as tooltip / command palette subtitle. */
  hint: string;
}

export interface NavGroup {
  label: string | null; // null = ungrouped (top)
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      {
        label: "Home",
        href: "/",
        icon: LayoutDashboard,
        status: "live",
        hint: "Your whole life at a glance",
      },
    ],
  },
  {
    label: "Plan & Do",
    items: [
      { label: "Goals", href: "/goals", icon: Target, status: "live", hint: "Big life goals — year & quarter" },
      { label: "Tasks", href: "/tasks", icon: ListChecks, status: "live", hint: "The execution engine" },
      { label: "Calendar", href: "/calendar", icon: CalendarDays, status: "live", hint: "Time-block your day & week" },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { label: "Notes", href: "/notes", icon: NotebookText, status: "live", hint: "Your second brain" },
      { label: "Learning", href: "/learning", icon: GraduationCap, status: "live", hint: "A page per topic you're studying" },
    ],
  },
  {
    label: "Self",
    items: [
      { label: "Journal", href: "/journal", icon: PenLine, status: "live", hint: "Daily entries & mood" },
      { label: "Habits", href: "/habits", icon: Repeat, status: "live", hint: "Streaks & routines" },
      { label: "Health", href: "/health", icon: HeartPulse, status: "live", hint: "Fitness & sleep" },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Money", href: "/money", icon: Wallet, status: "live", hint: "Income, expenses, runway" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings, status: "live", hint: "Connections" },
    ],
  },
];

/** Flat list of all items — handy for the command palette. */
export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);
