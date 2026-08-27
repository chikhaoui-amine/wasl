"use client";

import { useState } from "react";
import { usePwa } from "@/lib/pwa/usePwa";
import { WifiOff, RefreshCw, X, Sparkles, AlertCircle } from "lucide-react";
import { useDataEdition } from "@/lib/data/query/provider";

export function PwaBanner() {
  const edition = useDataEdition();
  const { isOffline, updateAvailable, applyUpdate } = usePwa();
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // PWA banner is only relevant for Local Edition or offline state
  if (edition !== "local" && !isOffline) {
    return null;
  }

  const handleUpdate = async () => {
    setUpdating(true);
    setUpdateError(null);
    try {
      const success = await applyUpdate();
      if (!success) {
        setUpdating(false);
        setUpdateError("Cannot update while unsaved note edits exist. Please save and retry.");
      }
    } catch {
      setUpdating(false);
      setUpdateError("Failed to apply update. Please retry.");
    }
  };

  return (
    <>
      {/* Offline Status Badge */}
      {isOffline && (
        <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-warn/40 bg-surface-1/95 px-3 py-1.5 text-xs font-medium text-warn shadow-float backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline — changes saved to device</span>
        </div>
      )}

      {/* Update Available Notification */}
      {updateAvailable && !dismissedUpdate && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm rounded-2xl border border-accent/40 bg-surface-1/95 p-4 text-text shadow-float backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-text">Update Available</p>
                <p className="text-[11px] text-muted leading-relaxed">
                  A new version of WASL has been downloaded. Update now to apply improvements.
                </p>
                {updateError && (
                  <p className="flex items-center gap-1 text-[11px] font-medium text-rose-400">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{updateError}</span>
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedUpdate(true)}
              className="rounded-lg p-1 text-faint hover:bg-surface-2 hover:text-text transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDismissedUpdate(true)}
              className="rounded-xl border border-border px-3 py-1.5 text-[11px] font-semibold text-muted hover:bg-surface-2 transition-colors"
            >
              Later
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={updating}
              className="btn-hero flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[11px] font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${updating ? "animate-spin" : ""}`} />
              {updating ? "Updating..." : "Update Now"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
