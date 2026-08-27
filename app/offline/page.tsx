"use client";

import Link from "next/link";
import { WifiOff, Home } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <div className="card max-w-md p-8 flex flex-col items-center space-y-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <WifiOff className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-xl font-bold text-text">You are Offline</h1>
          <p className="text-sm text-muted leading-relaxed">
            WASL Local Edition runs fully on your device. Your data is stored locally in IndexedDB and changes will be preserved.
          </p>
        </div>
        <Link
          href="/"
          className="btn-hero flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold"
        >
          <Home className="h-4 w-4" /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
