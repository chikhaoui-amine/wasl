import { todayISO, weekISO, fromISO } from "@/lib/date";
import type { BlocksPersistedState } from "../../types";

export interface Block {
  id: string;
  date: string; // ISO day
  start: number; // decimal hours, e.g. 9.5
  end: number;
  title: string;
  color: string;
}

export type BlockInput = Omit<Block, "id">;

export function getDefaultAnchor(): string {
  return weekISO(fromISO(todayISO()))[0];
}

export function createDefaultBlocksState(): BlocksPersistedState {
  const t = todayISO();
  return {
    blocks: [
      {
        id: "block-sample-1",
        date: t,
        start: 7.0, // 07:00
        end: 8.5,   // 08:30
        title: "Morning Routine & Physical Training",
        color: "#37c9b7",
      },
      {
        id: "block-sample-2",
        date: t,
        start: 9.0, // 09:00
        end: 11.5,  // 11:30
        title: "Deep Work: Core System Architecture",
        color: "#7c9cf5",
      },
      {
        id: "block-sample-3",
        date: t,
        start: 12.0, // 12:00
        end: 13.0,  // 13:00
        title: "Lunch & Recharging Walk",
        color: "#5fb36a",
      },
      {
        id: "block-sample-4",
        date: t,
        start: 14.0, // 14:00
        end: 16.5,  // 16:30
        title: "Strategy, Learning & Synthesis",
        color: "#b57edc",
      },
      {
        id: "block-sample-5",
        date: t,
        start: 20.5, // 20:30
        end: 21.5,  // 21:30
        title: "Evening Wind-down & Journal",
        color: "#e0a34a",
      },
    ],
    view: "week",
    anchor: getDefaultAnchor(),
  };
}

export function normalizeBlock(raw: unknown): Block {
  if (!raw || typeof raw !== "object") {
    return {
      id: crypto.randomUUID(),
      date: todayISO(),
      start: 9,
      end: 10,
      title: "Untitled Block",
      color: "var(--accent)",
    };
  }

  const b = raw as Record<string, unknown>;
  return {
    id: typeof b.id === "string" && b.id ? b.id : crypto.randomUUID(),
    date: typeof b.date === "string" ? b.date : todayISO(),
    start: typeof b.start === "number" ? b.start : 9,
    end: typeof b.end === "number" ? b.end : 10,
    title: typeof b.title === "string" ? b.title : "Untitled Block",
    color: typeof b.color === "string" ? b.color : "var(--accent)",
  };
}

export function normalizeBlocksState(raw: unknown): BlocksPersistedState {
  if (!raw || typeof raw !== "object") {
    return createDefaultBlocksState();
  }
  const state = raw as Record<string, unknown>;
  const initialAnchor = getDefaultAnchor();
  return {
    blocks: Array.isArray(state.blocks) ? state.blocks.map(normalizeBlock) : [],
    view: state.view === "day" || state.view === "week" ? state.view : "week",
    anchor: typeof state.anchor === "string" && state.anchor ? state.anchor : initialAnchor,
  };
}

export function addBlockOperation(current: BlocksPersistedState, newBlock: Block): BlocksPersistedState {
  return {
    ...current,
    blocks: [...current.blocks, normalizeBlock(newBlock)],
  };
}

export function updateBlockOperation(
  current: BlocksPersistedState,
  id: string,
  patch: Partial<BlockInput>,
): BlocksPersistedState {
  return {
    ...current,
    blocks: current.blocks.map((b) => (b.id === id ? normalizeBlock({ ...b, ...patch }) : b)),
  };
}

export function deleteBlockOperation(current: BlocksPersistedState, id: string): BlocksPersistedState {
  return {
    ...current,
    blocks: current.blocks.filter((b) => b.id !== id),
  };
}

export function setViewOperation(current: BlocksPersistedState, view: "week" | "day"): BlocksPersistedState {
  return {
    ...current,
    view,
  };
}

export function setAnchorOperation(current: BlocksPersistedState, anchor: string): BlocksPersistedState {
  return {
    ...current,
    anchor,
  };
}
