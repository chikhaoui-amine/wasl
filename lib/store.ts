"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY, type ThemeId } from "./themes";

export interface UIState {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  hydrateTheme: () => void;

  commandOpen: boolean;
  setCommandOpen: (b: boolean) => void;

  captureOpen: boolean;
  setCaptureOpen: (b: boolean) => void;

  trashOpen: boolean;
  setTrashOpen: (b: boolean) => void;

  onboardingOpen: boolean;
  setOnboardingOpen: (b: boolean) => void;
}

type Listener = () => void;

let theme: ThemeId = DEFAULT_THEME;
let commandOpen = false;
let captureOpen = false;
let trashOpen = false;
let onboardingOpen = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

const applyTheme = (t: ThemeId) => {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = t;
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {}
  }
};

let snapshot: UIState;

const actions = {
  setTheme: (t: ThemeId) => {
    theme = t;
    applyTheme(t);
    updateSnapshot();
  },
  hydrateTheme: () => {
    if (typeof window === "undefined") return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    } catch {}
    const t = (stored as ThemeId) || DEFAULT_THEME;
    theme = t;
    applyTheme(t);
    updateSnapshot();
  },
  setCommandOpen: (b: boolean) => {
    commandOpen = b;
    updateSnapshot();
  },
  setCaptureOpen: (b: boolean) => {
    captureOpen = b;
    updateSnapshot();
  },
  setTrashOpen: (b: boolean) => {
    trashOpen = b;
    updateSnapshot();
  },
  setOnboardingOpen: (b: boolean) => {
    onboardingOpen = b;
    updateSnapshot();
  },
};

function updateSnapshot() {
  snapshot = {
    theme,
    commandOpen,
    captureOpen,
    trashOpen,
    onboardingOpen,
    ...actions,
  };
  notify();
}

snapshot = {
  theme,
  commandOpen,
  captureOpen,
  trashOpen,
  onboardingOpen,
  ...actions,
};

function getSnapshot(): UIState {
  return snapshot;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUI(): UIState;
export function useUI<T>(selector: (state: UIState) => T): T;
export function useUI<T>(selector?: (state: UIState) => T): T | UIState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return selector ? selector(state) : state;
}

useUI.getState = getSnapshot;
