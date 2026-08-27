/**
 * Global coordinator for pending note drafts and autosaves.
 * Allows PWA update / reload handlers to verify that all in-flight or dirty note drafts
 * are safely written to IndexedDB / DataAdapter before applying updates or refreshing.
 */

export interface PendingSaveHandler {
  isDirty: () => boolean;
  flush: () => Promise<boolean>;
}

const handlers = new Set<PendingSaveHandler>();

export function registerPendingSaveHandler(handler: PendingSaveHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function hasPendingNotesSaves(): boolean {
  for (const handler of handlers) {
    try {
      if (handler.isDirty()) return true;
    } catch {
      return true;
    }
  }
  return false;
}

export async function flushAllPendingNotes(): Promise<boolean> {
  let allSuccess = true;
  for (const handler of handlers) {
    try {
      if (handler.isDirty()) {
        const success = await handler.flush();
        if (!success || handler.isDirty()) {
          allSuccess = false;
        }
      }
    } catch {
      allSuccess = false;
    }
  }
  return allSuccess;
}

export function resetPendingSavesForTesting(): void {
  handlers.clear();
}
