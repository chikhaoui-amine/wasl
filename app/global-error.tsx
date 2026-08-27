"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("WASL Global Fatal Error:", error);
  }, [error]);

  return (
    <html lang="en" data-theme="graphite">
      <body className="flex min-h-screen items-center justify-center bg-[#121212] text-[#e0e0e0] p-4">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#1e1e1e] p-6 text-center shadow-xl space-y-4">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-white">Application Error</h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              A critical error occurred while starting the application.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-black hover:bg-emerald-400 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reload application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
