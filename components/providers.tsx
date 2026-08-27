"use client";

import { useEffect } from "react";
import { useUI } from "@/lib/store";
import { DataProvider } from "@/lib/data/query/provider";
import { CommandPalette } from "@/components/command/CommandPalette";
import { QuickCapture } from "@/components/capture/QuickCapture";
import { PwaBanner } from "@/components/pwa/PwaBanner";
import { initServiceWorker } from "@/lib/pwa/service-worker";

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrateTheme = useUI((s) => s.hydrateTheme);
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const setCaptureOpen = useUI((s) => s.setCaptureOpen);

  useEffect(() => {
    hydrateTheme();
    initServiceWorker();
  }, [hydrateTheme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (!typing && e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCaptureOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen, setCaptureOpen]);

  return (
    <DataProvider>
      {children}
      <CommandPalette />
      <QuickCapture />
      <PwaBanner />
    </DataProvider>
  );
}
