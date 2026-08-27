"use client";

import { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Dumbbell,
  Sparkles,
  Layers,
  Calendar,
  RotateCcw,
} from "lucide-react";
import {
  useHealthData,
  type WorkoutProgram,
  type ProgramSession,
  type ProgramExercise,
  type TargetSet,
  type Exercise,
} from "@/lib/data/domains/health";
import { Modal, Field, FormFooter, inputCls } from "@/components/ui/Modal";
import { ExerciseLibraryModal } from "./ExerciseLibraryModal";
import { cn } from "@/lib/utils";

interface ProgramEditorModalProps {
  open: boolean;
  program?: WorkoutProgram;
  onClose: () => void;
}

const DRAFT_KEY = "wasl:program-draft";
const LEGACY_DRAFT_KEY = "lifeos:program-draft";

function getProgramDraft(): Partial<WorkoutProgram> | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = sessionStorage.getItem(DRAFT_KEY) || sessionStorage.getItem(LEGACY_DRAFT_KEY);
    return saved ? (JSON.parse(saved) as Partial<WorkoutProgram>) : null;
  } catch {
    return null;
  }
}

function ProgramEditorForm({
  program,
  onClose,
}: {
  program?: WorkoutProgram;
  onClose: () => void;
}) {
  const { addProgram, updateProgram } = useHealthData();

  const [name, setName] = useState<string>(() => {
    if (program?.name) return program.name;
    const draft = getProgramDraft();
    return draft?.name || "";
  });

  const [description, setDescription] = useState<string>(() => {
    if (program?.description) return program.description;
    const draft = getProgramDraft();
    return draft?.description || "";
  });

  const [sport, setSport] = useState<string>(() => {
    if (program?.sport) return program.sport;
    const draft = getProgramDraft();
    return draft?.sport || "Gym";
  });

  const [sessions, setSessions] = useState<ProgramSession[]>(() => {
    if (program?.sessions && program.sessions.length > 0) return program.sessions;
    const draft = getProgramDraft();
    if (Array.isArray(draft?.sessions) && draft.sessions.length > 0) return draft.sessions;
    return [
      {
        id: crypto.randomUUID(),
        name: "Push Day (Chest & Triceps)",
        dayName: "Day 1",
        sport: "Gym",
        exercises: [],
      },
    ];
  });

  const [activeSessionIdx, setActiveSessionIdx] = useState(0);
  const [pickingExercise, setPickingExercise] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Auto-save draft for new programs
  const saveDraft = (n: string, d: string, sp: string, sess: ProgramSession[]) => {
    if (program) return; // Don't overwrite draft when editing existing program
    if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current);
    draftSaveTimeout.current = setTimeout(() => {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ name: n, description: d, sport: sp, sessions: sess }),
        );
      } catch {}
    }, 400);
  };

  const handleClearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {}
    setName("");
    setDescription("");
    setSport("Gym");
    setSessions([
      {
        id: crypto.randomUUID(),
        name: "Push Day (Chest & Triceps)",
        dayName: "Day 1",
        sport: "Gym",
        exercises: [],
      },
    ]);
    setActiveSessionIdx(0);
    setDraftRestored(false);
  };

  const currentSession = sessions[activeSessionIdx] || sessions[0];

  // Session Handlers
  const handleAddSession = () => {
    const nextIdx = sessions.length + 1;
    const newSession: ProgramSession = {
      id: crypto.randomUUID(),
      name: `Session ${nextIdx}`,
      dayName: `Day ${nextIdx}`,
      sport: sport || "Gym",
      exercises: [],
    };
    const updated = [...sessions, newSession];
    setSessions(updated);
    setActiveSessionIdx(updated.length - 1);
    saveDraft(name, description, sport, updated);
  };

  const handleDeleteSession = (idx: number) => {
    if (sessions.length <= 1) return;
    const updated = sessions.filter((_, i) => i !== idx);
    setSessions(updated);
    setActiveSessionIdx(Math.max(0, idx - 1));
    saveDraft(name, description, sport, updated);
  };

  const handleUpdateSession = (patch: Partial<ProgramSession>) => {
    const updated = sessions.map((sess, idx) => (idx === activeSessionIdx ? { ...sess, ...patch } : sess));
    setSessions(updated);
    saveDraft(name, description, sport, updated);
  };

  // Exercise Handlers for Current Session
  const handleSelectExerciseFromLib = (ex: Exercise) => {
    if (!currentSession) return;
    const newProgEx: ProgramExercise = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      targetSets: [
        { reps: 8, weightKg: 0, type: "N", restSec: 90 },
        { reps: 8, weightKg: 0, type: "N", restSec: 90 },
        { reps: 8, weightKg: 0, type: "N", restSec: 90 },
      ],
    };
    const updatedExs = [...currentSession.exercises, newProgEx];
    handleUpdateSession({ exercises: updatedExs });
    setPickingExercise(false);
  };

  const handleDeleteExercise = (exIdx: number) => {
    if (!currentSession) return;
    const updatedExs = currentSession.exercises.filter((_, i) => i !== exIdx);
    handleUpdateSession({ exercises: updatedExs });
  };

  const handleMoveExercise = (exIdx: number, direction: -1 | 1) => {
    if (!currentSession) return;
    const target = exIdx + direction;
    if (target < 0 || target >= currentSession.exercises.length) return;
    const updatedExs = [...currentSession.exercises];
    const [moved] = updatedExs.splice(exIdx, 1);
    updatedExs.splice(target, 0, moved);
    handleUpdateSession({ exercises: updatedExs });
  };

  // Target Set Handlers
  const handleAddTargetSet = (exIdx: number) => {
    if (!currentSession) return;
    const updatedExs = [...currentSession.exercises];
    const curEx = updatedExs[exIdx];
    const lastSet = curEx.targetSets.at(-1);
    const newSet: TargetSet = {
      reps: lastSet?.reps || 8,
      weightKg: lastSet?.weightKg || 0,
      type: lastSet?.type || "N",
      restSec: lastSet?.restSec || 90,
    };
    curEx.targetSets = [...curEx.targetSets, newSet];
    handleUpdateSession({ exercises: updatedExs });
  };

  const handleDeleteTargetSet = (exIdx: number, setIdx: number) => {
    if (!currentSession) return;
    const updatedExs = [...currentSession.exercises];
    const curEx = updatedExs[exIdx];
    if (curEx.targetSets.length <= 1) return;
    curEx.targetSets = curEx.targetSets.filter((_, i) => i !== setIdx);
    handleUpdateSession({ exercises: updatedExs });
  };

  const handleUpdateTargetSet = (exIdx: number, setIdx: number, patch: Partial<TargetSet>) => {
    if (!currentSession) return;
    const updatedExs = [...currentSession.exercises];
    const curEx = updatedExs[exIdx];
    curEx.targetSets = curEx.targetSets.map((st, i) => (i === setIdx ? { ...st, ...patch } : st));
    handleUpdateSession({ exercises: updatedExs });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (program) {
      updateProgram(program.id, {
        name: name.trim(),
        description: description.trim(),
        sport,
        sessions,
      });
    } else {
      addProgram({
        name: name.trim(),
        description: description.trim(),
        sport,
        sessions,
      });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
    }
    onClose();
  };

  const SPORTS = ["Gym", "Calisthenics", "Running", "Swimming", "Martial arts", "CrossFit", "Other"];

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Draft Notice */}
        {draftRestored && !program && (
          <div className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs text-accent">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Restored unsaved draft
            </span>
            <button
              type="button"
              onClick={handleClearDraft}
              className="flex items-center gap-1 text-[11px] font-bold underline hover:opacity-80"
            >
              <RotateCcw className="h-3 w-3" /> Start Blank
            </button>
          </div>
        )}

        {/* Basic Program Info */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Program Title">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  saveDraft(e.target.value, description, sport, sessions);
                }}
                placeholder="e.g. Hypertrophy Mastery (Upper / Lower)"
                className={inputCls}
              />
            </Field>
          </div>

          <div>
            <Field label="Sport / Discipline">
              <select
                value={sport}
                onChange={(e) => {
                  setSport(e.target.value);
                  saveDraft(name, description, e.target.value, sessions);
                }}
                className={inputCls}
              >
                {SPORTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="sm:col-span-3">
            <Field label="Description & Goals">
              <input
                type="text"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  saveDraft(name, e.target.value, sport, sessions);
                }}
                placeholder="e.g. 4-day linear progression focused on compound lifts and hypertrophy."
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* Sessions Workspace */}
        <div className="space-y-3 rounded-2xl border border-border/80 bg-surface-2/40 p-3 sm:p-4">
          {/* Header with Session Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {sessions.map((sess, idx) => (
                <button
                  key={sess.id || idx}
                  type="button"
                  onClick={() => setActiveSessionIdx(idx)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all border",
                    activeSessionIdx === idx
                      ? "bg-accent text-bg border-accent shadow-sm"
                      : "bg-surface-2 text-muted border-border/80 hover:text-text hover:bg-surface-3",
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  <span>{sess.name || `Session ${idx + 1}`}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[9px]",
                      activeSessionIdx === idx ? "bg-bg/20 text-bg" : "bg-surface-3 text-faint",
                    )}
                  >
                    {sess.exercises?.length || 0}
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={handleAddSession}
                className="flex items-center gap-1 rounded-xl border border-dashed border-border px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Day</span>
              </button>
            </div>

            {sessions.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteSession(activeSessionIdx)}
                className="flex items-center gap-1 text-xs font-medium text-danger hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Day
              </button>
            )}
          </div>

          {/* Active Session Content */}
          {currentSession && (
            <div className="space-y-4 pt-1">
              {/* Session Meta Info */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Session Name">
                  <input
                    type="text"
                    value={currentSession.name}
                    onChange={(e) => handleUpdateSession({ name: e.target.value })}
                    placeholder="e.g. Pull Day (Back & Biceps)"
                    className={inputCls}
                  />
                </Field>
                <Field label="Day Label / Frequency">
                  <input
                    type="text"
                    value={currentSession.dayName}
                    onChange={(e) => handleUpdateSession({ dayName: e.target.value })}
                    placeholder="e.g. Day 1, Monday, or As Needed"
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Exercises List for Session */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-accent" /> Exercises & Target Sets (
                    {currentSession.exercises.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setPickingExercise(true)}
                    className="flex items-center gap-1 text-xs font-bold text-accent hover:opacity-80"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Exercise
                  </button>
                </div>

                {currentSession.exercises.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 py-10 text-center space-y-2 bg-surface-2/30">
                    <Dumbbell className="mx-auto h-8 w-8 text-faint" />
                    <p className="text-xs text-muted font-medium">
                      No exercises in this session yet. Tap &quot;+ Add Exercise&quot; to choose from 50+ library lifts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {currentSession.exercises.map((ex, exIdx) => (
                      <div
                        key={`${ex.exerciseId}-${exIdx}`}
                        className="rounded-2xl border border-border bg-surface-2/70 p-3.5 sm:p-4 space-y-3 shadow-sm hover:border-border-strong transition-all"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="grid h-6 w-6 place-items-center rounded-md bg-surface text-[11px] font-mono font-bold text-muted border border-border">
                              {exIdx + 1}
                            </span>
                            <h5 className="font-bold text-sm text-text">{ex.exerciseName}</h5>
                          </div>

                          <div className="flex items-center gap-1 text-muted">
                            <button
                              type="button"
                              onClick={() => handleMoveExercise(exIdx, -1)}
                              disabled={exIdx === 0}
                              className="p-1 hover:text-text disabled:opacity-30 rounded"
                              title="Move up"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveExercise(exIdx, 1)}
                              disabled={exIdx === currentSession.exercises.length - 1}
                              className="p-1 hover:text-text disabled:opacity-30 rounded"
                              title="Move down"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteExercise(exIdx)}
                              className="p-1 text-faint hover:text-danger rounded"
                              title="Remove exercise"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Target Sets Matrix */}
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-faint px-1">
                            <span className="col-span-2">Set</span>
                            <span className="col-span-3">Target Reps</span>
                            <span className="col-span-3">Weight (kg)</span>
                            <span className="col-span-3">Rest (s)</span>
                            <span className="col-span-1 text-center">Del</span>
                          </div>

                          {ex.targetSets.map((st, setIdx) => (
                            <div
                              key={setIdx}
                              className="grid grid-cols-12 gap-2 items-center text-xs p-1 rounded-lg bg-surface-1 border border-border/50"
                            >
                              <div className="col-span-2 flex items-center gap-1">
                                <span className="font-mono font-bold text-muted text-[11px]">
                                  #{setIdx + 1}
                                </span>
                                <select
                                  value={st.type || "N"}
                                  onChange={(e) =>
                                    handleUpdateTargetSet(exIdx, setIdx, {
                                      type: e.target.value as "W" | "N" | "D" | "F",
                                    })
                                  }
                                  className="rounded bg-surface-2 px-1 py-0.5 text-[9px] font-bold text-muted border border-border"
                                >
                                  <option value="N">Norm</option>
                                  <option value="W">Warm</option>
                                  <option value="D">Drop</option>
                                  <option value="F">Fail</option>
                                </select>
                              </div>

                              <input
                                type="number"
                                min={1}
                                value={st.reps}
                                onChange={(e) =>
                                  handleUpdateTargetSet(exIdx, setIdx, {
                                    reps: Number(e.target.value),
                                  })
                                }
                                className="col-span-3 rounded-lg border border-border bg-surface-2 px-2 py-1 text-center font-mono text-xs font-semibold text-text outline-none focus:border-accent"
                              />

                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={st.weightKg || ""}
                                placeholder="0"
                                onChange={(e) =>
                                  handleUpdateTargetSet(exIdx, setIdx, {
                                    weightKg: Number(e.target.value),
                                  })
                                }
                                className="col-span-3 rounded-lg border border-border bg-surface-2 px-2 py-1 text-center font-mono text-xs font-semibold text-text outline-none focus:border-accent"
                              />

                              <input
                                type="number"
                                min={0}
                                step={15}
                                value={st.restSec || 90}
                                onChange={(e) =>
                                  handleUpdateTargetSet(exIdx, setIdx, {
                                    restSec: Number(e.target.value),
                                  })
                                }
                                className="col-span-3 rounded-lg border border-border bg-surface-2 px-2 py-1 text-center font-mono text-xs font-semibold text-text outline-none focus:border-accent"
                              />

                              <div className="col-span-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTargetSet(exIdx, setIdx)}
                                  disabled={ex.targetSets.length <= 1}
                                  className="text-faint hover:text-danger disabled:opacity-20"
                                  title="Delete set"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => handleAddTargetSet(exIdx)}
                            className="w-full py-1 text-[11px] font-semibold text-accent/80 hover:text-accent rounded-lg border border-dashed border-border/80 hover:border-accent/60 transition-all flex items-center justify-center gap-1"
                          >
                            <Plus className="h-3 w-3" /> Add Target Set
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <FormFooter
          submitLabel={program ? "Save Program Changes" : "Create Workout Program"}
          disabled={!name.trim() || sessions.length === 0}
        />
      </form>

      {/* Library Modal */}
      <ExerciseLibraryModal
        open={pickingExercise}
        onClose={() => setPickingExercise(false)}
        onSelectExercise={handleSelectExerciseFromLib}
      />
    </>
  );
}

export function ProgramEditorModal({ open, program, onClose }: ProgramEditorModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="3xl"
      title={program ? "Edit Workout Program" : "Create Workout Program"}
      preventBackdropClose={true}
    >
      {open ? <ProgramEditorForm program={program} onClose={onClose} /> : null}
    </Modal>
  );
}
