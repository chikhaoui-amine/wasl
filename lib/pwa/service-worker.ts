import { flushAllPendingNotes } from "@/lib/data/domains/notes";

export interface PwaState {
  isOffline: boolean;
  updateAvailable: boolean;
  waitingWorker: ServiceWorker | null;
  registration: ServiceWorkerRegistration | null;
}

type PwaListener = (state: PwaState) => void;

let pwaState: PwaState = {
  isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
  updateAvailable: false,
  waitingWorker: null,
  registration: null,
};

const listeners = new Set<PwaListener>();

function notify() {
  for (const listener of listeners) {
    listener(pwaState);
  }
}

export function getPwaState(): PwaState {
  return pwaState;
}

export function subscribePwaState(listener: PwaListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetPwaStateForTesting(): void {
  pwaState = {
    isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
    updateAvailable: false,
    waitingWorker: null,
    registration: null,
  };
  listeners.clear();
}

/**
 * Initialize service worker for Local edition.
 */
export async function initServiceWorker(): Promise<void> {
  if (typeof window === "undefined" || !navigator || !("serviceWorker" in navigator)) {
    return;
  }

  // Setup online / offline status & listeners
  pwaState = {
    ...pwaState,
    isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
  };

  const updateOnlineStatus = () => {
    pwaState = { ...pwaState, isOffline: !navigator.onLine };
    notify();
  };

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  try {
    const swUrl = "/sw.js";
    const registration = await navigator.serviceWorker.register(swUrl, { scope: "/" });
    pwaState = { ...pwaState, registration };

    // Nudge an already-active worker to re-check the precache manifest so a
    // new deploy is cached immediately.
    try {
      registration.active?.postMessage({ type: "WASL_PRECACHE_REFRESH" });
    } catch {
      // First visit: no active worker yet — the install step adopts the manifest.
    }

    // Check if a worker is already waiting
    if (registration.waiting) {
      pwaState = {
        ...pwaState,
        updateAvailable: true,
        waitingWorker: registration.waiting,
      };
      notify();
    }

    // Detect updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          // New worker is installed and waiting
          pwaState = {
            ...pwaState,
            updateAvailable: true,
            waitingWorker: newWorker,
          };
          notify();
        }
      });
    });

    // Reload when new worker takes control after skipWaiting
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  } catch (err) {
    console.warn("Failed to register service worker in Local Edition:", err);
  }
}

/**
 * Applies the waiting service worker update cleanly after verifying all pending notes are flushed.
 * If flushing fails or unsaved drafts remain, cancels reload to prevent data loss.
 */
export async function applyServiceWorkerUpdate(): Promise<boolean> {
  const flushed = await flushAllPendingNotes();
  if (!flushed) {
    console.warn("Update cancelled: could not safely flush unsaved notes.");
    return false;
  }

  if (pwaState.waitingWorker) {
    pwaState.waitingWorker.postMessage({ type: "SKIP_WAITING" });
    return true;
  } else if (typeof window !== "undefined") {
    window.location.reload();
    return true;
  }
  return false;
}
