"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** True after first client render — gate persisted-store UI to avoid SSR mismatch. */
export function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/** Renders a calm skeleton until the client is ready. */
export function Hydrate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="space-y-4 pt-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="card animate-pulse"
            style={{ height: i === 0 ? 96 : 160, opacity: 0.5 }}
          />
        ))}
      </div>
    );
  }
  return <>{children}</>;
}
