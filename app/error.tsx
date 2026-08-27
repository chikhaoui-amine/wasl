"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Card } from "@/components/ui/primitives";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client error for debugging
    console.error("WASL App Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md w-full p-6 text-center space-y-4 border border-border/80 shadow-lg">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold text-text">
            Something went wrong
          </h2>
          <p className="text-xs text-muted leading-relaxed">
            An unexpected error occurred while loading this section. Your data is safely preserved.
          </p>
        </div>

        {error?.message && (
          <div className="rounded-lg bg-surface-2/60 p-2.5 text-left text-[11px] font-mono text-faint truncate">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="btn-hero flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
          <Link
            href="/"
            className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-full border border-border bg-surface-2 px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-hover hover:text-text transition-colors"
          >
            <Home className="h-3.5 w-3.5" /> Return home
          </Link>
        </div>
      </Card>
    </div>
  );
}
