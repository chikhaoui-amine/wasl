"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { TrashModal } from "@/components/trash/TrashModal";
import { LocalOnboardingModal, ONBOARDING_STORAGE_KEY } from "@/components/onboarding/LocalOnboardingModal";
import { ActiveWorkoutBar } from "@/components/health/ActiveWorkoutBar";
import { useUI } from "@/lib/store";

// The workout logger is a 1300-line modal with the whole health store behind
// it; lazy-loading keeps it off every route's initial bundle.
const WorkoutLoggerModal = dynamic(
  () => import("@/components/health/WorkoutLoggerModal").then((m) => m.WorkoutLoggerModal),
  { ssr: false },
);

export function AppFrame({ children }: { children: React.ReactNode }) {
  const trashOpen = useUI((s) => s.trashOpen);
  const setTrashOpen = useUI((s) => s.setTrashOpen);
  const onboardingOpen = useUI((s) => s.onboardingOpen);
  const setOnboardingOpen = useUI((s) => s.setOnboardingOpen);

  useEffect(() => {
    try {
      const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!completed) {
        setOnboardingOpen(true);
      }
    } catch {}
  }, [setOnboardingOpen]);

  return (
    <div suppressHydrationWarning className="relative min-h-dvh">
      <div className="app-backdrop" aria-hidden />

      <div className="relative z-10 flex min-h-dvh xl:h-dvh xl:gap-4 xl:p-4">
        <Sidebar />
        <div className="app-canvas relative flex min-w-0 flex-1 flex-col xl:overflow-hidden">
          <div className="app-ambient" aria-hidden />
          <div className="app-grain" aria-hidden />
          <div className="relative z-10 min-h-0 flex-1 xl:overflow-y-auto">
            <Topbar />
            <main className="mx-auto w-full max-w-7xl 2xl:max-w-[1400px] px-3.5 pb-28 pt-4 sm:px-4 sm:pt-6 sm:pb-36 md:px-6 md:pb-12">
              {children}
            </main>
          </div>
        </div>
      </div>

      <ActiveWorkoutBar />
      <WorkoutLoggerModal />
      <MobileNav />
      <TrashModal open={trashOpen} onClose={() => setTrashOpen(false)} />
      <LocalOnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  );
}
