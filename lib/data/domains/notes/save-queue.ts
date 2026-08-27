/**
 * CoalescingSaveQueue manages serial asynchronous persistence operations
 * where rapid intermediate drafts are superseded by the newest payload.
 *
 * Guarantees:
 * 1. At most one save operation in-flight at any time.
 * 2. At most one pending payload waiting for the in-flight save to complete.
 * 3. Intermediate obsolete drafts between in-flight start and completion are discarded.
 * 4. A failed save preserves the latest draft and notifies the consumer for retry.
 */
export type SaveStatus = "saved" | "saving" | "failed";

export interface CoalescingSaveQueueOptions<T> {
  onStatusChange?: (status: SaveStatus, error?: Error) => void;
  saveFn?: (payload: T) => Promise<void>;
}

export class CoalescingSaveQueue<T> {
  private inFlightPromise: Promise<void> | null = null;
  private pendingPayload: T | null = null;
  private latestDraft: T | null = null;
  private saveFn: (payload: T) => Promise<void>;
  private onStatusChange?: (status: SaveStatus, error?: Error) => void;
  private status: SaveStatus = "saved";
  private writeCount = 0;

  constructor(options?: CoalescingSaveQueueOptions<T>) {
    this.saveFn = options?.saveFn ?? (() => Promise.resolve());
    this.onStatusChange = options?.onStatusChange;
  }

  public setSaveFn(fn: (payload: T) => Promise<void>): void {
    this.saveFn = fn;
  }

  public setOnStatusChange(cb?: (status: SaveStatus, error?: Error) => void): void {
    this.onStatusChange = cb;
  }

  public getStatus(): SaveStatus {
    return this.status;
  }

  public getLatestDraft(): T | null {
    return this.latestDraft;
  }

  public getWriteCount(): number {
    return this.writeCount;
  }

  public isDirty(): boolean {
    return this.status === "saving" || this.pendingPayload !== null || this.status === "failed";
  }

  /**
   * Enqueue a new payload for saving.
   * If a save is already in-flight, the payload replaces any existing pending payload.
   */
  public enqueue(payload: T): Promise<void> {
    this.latestDraft = payload;

    if (this.inFlightPromise) {
      this.pendingPayload = payload;
      this.setStatus("saving");
      return this.inFlightPromise;
    }

    return this.executeSave(payload);
  }

  /**
   * Immediately execute save for a given payload, chaining any pending payload upon completion.
   */
  private executeSave(payload: T): Promise<void> {
    this.setStatus("saving");

    const currentPromise = (async () => {
      try {
        await this.saveFn(payload);
        this.writeCount++;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.setStatus("failed", error);
        throw error;
      } finally {
        this.inFlightPromise = null;
        if (this.pendingPayload !== null) {
          const next = this.pendingPayload;
          this.pendingPayload = null;
          // Process latest coalesced payload
          await this.executeSave(next);
        } else if (this.status !== "failed") {
          this.setStatus("saved");
        }
      }
    })();

    this.inFlightPromise = currentPromise;
    return currentPromise;
  }

  /**
   * Force flush any pending draft or wait for in-flight save to settle.
   */
  public async flush(): Promise<void> {
    if (this.pendingPayload !== null) {
      const next = this.pendingPayload;
      this.pendingPayload = null;
      if (this.inFlightPromise) {
        try {
          await this.inFlightPromise;
        } catch {
          // In-flight error is handled; continue to execute latest pending draft
        }
      }
      await this.executeSave(next);
    } else if (this.inFlightPromise) {
      await this.inFlightPromise;
    }
  }

  /**
   * Retry the latest draft if previous save failed.
   */
  public async retry(): Promise<void> {
    if (this.latestDraft !== null) {
      this.pendingPayload = null;
      await this.executeSave(this.latestDraft);
    }
  }

  private setStatus(status: SaveStatus, error?: Error) {
    this.status = status;
    this.onStatusChange?.(status, error);
  }
}
