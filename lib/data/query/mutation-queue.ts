"use client";

import { useRef } from "react";

/**
 * Creates a serializer that forces async mutations to run strictly one at a
 * time in call order, even if the caller fires them back-to-back.
 *
 * This matters for CloudAdapter's compare-and-swap writes: two concurrent
 * mutations read the same `updated_at`, and after retries the loser throws a
 * ConflictError and the user's action is lost. Serializing per-store removes
 * the race entirely.
 *
 * Usage:
 *   const enqueue = useSerializedMutations();
 *   // inside mutationFn:
 *   return enqueue(async () => { ...read-modify-write... });
 */
export function useSerializedMutations(): <T>(run: () => Promise<T>) => Promise<T> {
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  return <T>(run: () => Promise<T>): Promise<T> => {
    const next = queueRef.current.then(run, run);
    // Swallow rejections on the chain pointer so one failure never poisons
    // subsequent queued work; the original promise still rejects for its caller.
    queueRef.current = next.catch(() => undefined);
    return next;
  };
}
