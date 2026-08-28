"use client";

import { Dumbbell, Layers, Play, Plus, Sparkles, ChevronRight, Zap, Footprints, Droplet, Flame } from "lucide-react";
import { useHealthData, type ProgramSession, type WorkoutProgram } from "@/lib/data/domains/health";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

interface ProgramPickerModalProps {
  open: boolean;
  sport?: string;
  onClose: () => void;
  onSelectSession: (session?: ProgramSession, sportOverride?: string) => void;
  onCreateProgramClick?: () => void;
}

export function ProgramPickerModal({
  open,
  sport,
  onClose,
  onSelectSession,
  onCreateProgramClick,
}: ProgramPickerModalProps) {
  const { programs } = useHealthData();

  const selectedSport = sport || "Gym";

  // Filter programs matching the selected sport or containing matching sessions
  const matchingPrograms = programs.filter(
    (p) =>
      p.sport?.toLowerCase() === selectedSport.toLowerCase() ||
      p.sessions.some((s) => s.sport?.toLowerCase() === selectedSport.toLowerCase()),
  );

  // Other programs not directly matching
  const otherPrograms = programs.filter(
    (p) => !matchingPrograms.some((mp) => mp.id === p.id),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      title={
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4.5 w-4.5 text-accent" />
          <span>Select Program or Start Session</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Quick Custom Workout Option */}
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 sm:p-3.5 space-y-2">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5">
            <div>
              <h4 className="font-bold text-[13.5px] sm:text-[14px] text-text flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-accent fill-current" /> Quick Free-Form {selectedSport} Session
              </h4>
              <p className="text-[11.5px] sm:text-xs text-muted">Log a custom session without loading a pre-set template.</p>
            </div>
            <button
              onClick={() => {
                onSelectSession(undefined, selectedSport);
                onClose();
              }}
              className="btn-hero flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] font-bold self-start xs:self-auto shrink-0"
            >
              Start Free <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Saved Programs List */}
        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {matchingPrograms.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Recommended {selectedSport} Programs
              </span>

              {matchingPrograms.map((prog) => (
                <div key={prog.id} className="rounded-xl border border-border/80 bg-surface-1 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[14px] text-text">{prog.name}</h4>
                      {prog.description && <p className="text-[11px] text-muted">{prog.description}</p>}
                    </div>
                    {prog.active && (
                      <span className="rounded-full bg-accent/20 border border-accent/40 px-2 py-0.5 text-[10px] font-bold text-accent">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 border-t border-border/60 pt-2">
                    {prog.sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="flex items-center justify-between rounded-lg bg-surface-2/70 p-2.5 text-xs hover:bg-surface-2 transition-colors"
                      >
                        <div>
                          <span className="font-bold text-text">{sess.name}</span>
                          <span className="ml-2 text-[11px] text-faint">
                            ({sess.exercises.length} exercises · {sess.dayName})
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            onSelectSession(sess);
                            onClose();
                          }}
                          className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-fg hover:opacity-90 transition-opacity"
                        >
                          <Play className="h-3 w-3 fill-current" /> Select
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Other Programs */}
          {otherPrograms.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-faint flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Other Training Programs
              </span>

              {otherPrograms.map((prog) => (
                <div key={prog.id} className="rounded-xl border border-border/60 bg-surface-1/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-text">{prog.name} ({prog.sport})</h4>
                      <p className="text-[10px] text-faint">{prog.sessions.length} sessions</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {prog.sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="flex items-center justify-between rounded-lg bg-surface-2/40 p-2 text-xs"
                      >
                        <span className="font-medium text-text">{sess.name}</span>
                        <button
                          onClick={() => {
                            onSelectSession(sess);
                            onClose();
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-accent hover:underline"
                        >
                          <Play className="h-3 w-3 fill-current" /> Select
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {matchingPrograms.length === 0 && otherPrograms.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/80 p-5 text-center text-xs text-faint space-y-2">
              <p>No saved training programs found.</p>
              {onCreateProgramClick && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateProgramClick();
                  }}
                  className="inline-flex items-center gap-1 text-accent font-bold hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Create a Program Now
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
