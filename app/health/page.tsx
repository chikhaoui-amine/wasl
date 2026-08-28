"use client";

import { useState } from "react";
import {
  Activity,
  ChevronRight,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Layers,
  Moon,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Scale,
  Trash2,
  Trophy,
  Zap,
} from "lucide-react";
import {
  useHealthData,
  thisWeekActivity,
  weightSeries,
  type WorkoutProgram,
  type ProgramSession,
} from "@/lib/data/domains/health";
import { useTrashData } from "@/lib/data/domains/trash";
import { Card, ProgressBar, SectionTitle } from "@/components/ui/primitives";
import { Modal, Field, FormFooter, inputCls } from "@/components/ui/Modal";
import { Hydrate } from "@/lib/hydration";
import { cn } from "@/lib/utils";

// Sub-components
import { ProgramEditorModal } from "@/components/health/ProgramEditorModal";
import { ProgressCharts } from "@/components/health/ProgressCharts";
import { TrainingCalendar } from "@/components/health/TrainingCalendar";
import { TrashModal } from "@/components/trash/TrashModal";
import { SleepLoggerModal } from "@/components/health/SleepLoggerModal";
import { WeightLoggerModal } from "@/components/health/WeightLoggerModal";
import { ProgramPickerModal } from "@/components/health/ProgramPickerModal";

type Tab = "dashboard" | "programs" | "progress";

export default function HealthPage() {
  const {
    days,
    workouts,
    programs,
    goals,
    day,
    patchDay,
    setActiveProgram,
    deleteProgram,
    restoreDefaultPrograms,
    startActiveWorkout,
  } = useHealthData();

  const { items: trashItems } = useTrashData();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  // Modals state
  const [loggingDay, setLoggingDay] = useState(false);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<WorkoutProgram | undefined>();
  const [isProgramEditorOpen, setIsProgramEditorOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // Program picker state
  const [isProgramPickerOpen, setIsProgramPickerOpen] = useState(false);
  const [pickerSport, setPickerSport] = useState<string>("Gym");

  const today = day();
  const weekAct = thisWeekActivity(workouts);
  const weights = weightSeries(days);
  const latestWeight = weights.at(-1)?.value;

  // Handler to launch active session or quick workout
  const handleStartWorkout = (session?: ProgramSession, sport?: string) => {
    startActiveWorkout(session, sport);
  };

  // Handler when clicking quick sport buttons
  const handleQuickSportClick = (sport: string) => {
    setPickerSport(sport);
    setIsProgramPickerOpen(true);
  };

  // Day logging state
  const [stepsInput, setStepsInput] = useState(today.steps || "");
  const [sleepInput, setSleepInput] = useState(today.sleepH || "");
  const [waterInput, setWaterInput] = useState(today.waterCups || "");
  const [weightInput, setWeightInput] = useState(today.weightKg || "");
  const [sorenessInput, setSorenessInput] = useState(today.soreness || 3);
  const [energyInput, setEnergyInput] = useState(today.energy || 4);

  const handleSaveDay = (e: React.FormEvent) => {
    e.preventDefault();
    patchDay({
      steps: Number(stepsInput) || 0,
      sleepH: Number(sleepInput) || 0,
      waterCups: Number(waterInput) || 0,
      weightKg: weightInput ? Number(weightInput) : undefined,
      soreness: Number(sorenessInput),
      energy: Number(energyInput),
    });
    setLoggingDay(false);
  };

  return (
    <Hydrate>
      <div className="space-y-6">
        {/* Top Weekly Performance Banner (4 Metric Tiles) */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-2.5 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] font-semibold text-muted">
              <span>Workouts This Week</span>
              <Dumbbell className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent" />
            </div>
            <div className="mt-1.5 sm:mt-2 font-display text-xl sm:text-2xl font-bold text-text">
              {weekAct.sessions}{" "}
              <span className="text-xs font-normal text-faint">/ {goals.sessionsPerWeek}</span>
            </div>
            <div className="mt-1.5">
              <ProgressBar value={(weekAct.sessions / goals.sessionsPerWeek) * 100} />
            </div>
          </div>

          <div className="card p-2.5 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] font-semibold text-muted">
              <span>Total Workouts</span>
              <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent" />
            </div>
            <div className="mt-1.5 sm:mt-2 font-display text-xl sm:text-2xl font-bold text-text">
              {workouts.length}
            </div>
            <span className="mt-1 sm:mt-1.5 text-[9.5px] sm:text-[10px] text-faint">Lifetime sessions</span>
          </div>

          {/* Bodyweight Tile with Direct Log Button */}
          <div
            onClick={() => setIsWeightModalOpen(true)}
            className="card p-2.5 sm:p-3.5 flex flex-col justify-between cursor-pointer hover:border-accent/50 transition-all group"
          >
            <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] font-semibold text-muted group-hover:text-accent transition-colors">
              <span>Bodyweight</span>
              <Scale className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent" />
            </div>
            <div className="mt-1.5 sm:mt-2 font-display text-xl sm:text-2xl font-bold text-text">
              {latestWeight ? `${latestWeight} kg` : "—"}
            </div>
            <div className="mt-1 sm:mt-1.5 flex items-center justify-between text-[9.5px] sm:text-[10px]">
              <span className="text-faint">{today.weightKg ? "Logged" : "Latest"}</span>
              <span className="font-bold text-accent group-hover:underline flex items-center gap-0.5">
                Log <Plus className="h-3 w-3" />
              </span>
            </div>
          </div>

          {/* Sleep Duration Tile with Direct Log Button */}
          <div
            onClick={() => setIsSleepModalOpen(true)}
            className="card p-2.5 sm:p-3.5 flex flex-col justify-between cursor-pointer hover:border-accent/50 transition-all group"
          >
            <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] font-semibold text-muted group-hover:text-accent transition-colors">
              <span>Sleep</span>
              <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent" />
            </div>
            <div className="mt-1.5 sm:mt-2 font-display text-xl sm:text-2xl font-bold text-text">
              {today.sleepH ? `${today.sleepH} h` : "—"}
            </div>
            <div className="mt-1 sm:mt-1.5 flex items-center justify-between text-[9.5px] sm:text-[10px]">
              <span className="text-faint">{goals.sleepH}h target</span>
              <span className="font-bold text-accent group-hover:underline flex items-center gap-0.5">
                Log <Plus className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation & Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-border/60 pb-2">
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none">
            {(
              [
                { id: "dashboard", label: "Dashboard", icon: Activity },
                { id: "programs", label: "Plans", icon: Layers },
                { id: "progress", label: "Progress", icon: Trophy },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-[11.5px] sm:text-[12px] font-semibold transition-all shrink-0",
                    activeTab === tab.id
                      ? "bg-accent text-accent-fg shadow-sm"
                      : "bg-surface-2 text-muted hover:bg-surface-hover hover:text-text",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setIsWeightModalOpen(true)}
              className="flex items-center gap-1 rounded-full border border-border/80 bg-surface-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-semibold text-text hover:bg-surface-2 hover:border-accent/40 transition"
            >
              <Scale className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-accent" />
              <span className="hidden sm:inline">Log Weight</span>
              <span className="sm:hidden">Weight</span>
            </button>
            <button
              onClick={() => setIsSleepModalOpen(true)}
              className="flex items-center gap-1 rounded-full border border-border/80 bg-surface-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-semibold text-text hover:bg-surface-2 hover:border-accent/40 transition"
            >
              <Moon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-accent" />
              <span className="hidden sm:inline">Log Sleep</span>
              <span className="sm:hidden">Sleep</span>
            </button>
          </div>
        </div>

        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-4 sm:space-y-6">
            {/* Quick Sport Launchers Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { sport: "Gym", label: "Gym Workout", icon: Dumbbell, color: "text-blue-400" },
                { sport: "Calisthenics", label: "Calisthenics", icon: Zap, color: "text-amber-400" },
                { sport: "Running", label: "Running Session", icon: Footprints, color: "text-emerald-400" },
                { sport: "Swimming", label: "Swimming Laps", icon: Droplet, color: "text-cyan-400" },
                { sport: "Martial arts", label: "Combat / Boxing", icon: Flame, color: "text-red-400" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.sport}
                    onClick={() => handleQuickSportClick(item.sport)}
                    className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-1 p-2.5 sm:p-3.5 text-left transition-all hover:bg-surface-hover hover:border-accent/40 group"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className={cn("grid h-7.5 w-7.5 sm:h-9 sm:w-9 place-items-center rounded-lg bg-surface-2", item.color)}>
                        <Icon className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
                      </span>
                      <span className="font-bold text-[12px] sm:text-[13px] text-text group-hover:text-accent transition-colors">
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-faint group-hover:text-accent transition-colors" />
                  </button>
                );
              })}
            </div>

            {/* Training Calendar Grid with interactive day selection and organized workout history */}
            <TrainingCalendar onStartWorkoutClick={() => setIsProgramPickerOpen(true)} />
          </div>
        )}

        {/* TAB 2: TRAINING PLANS (PROGRAMS) */}
        {activeTab === "programs" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <SectionTitle>My Training Programs</SectionTitle>
              <div className="flex items-center gap-2">
                {programs.length === 0 && (
                  <button
                    onClick={() => restoreDefaultPrograms()}
                    className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-[12px] font-semibold text-accent hover:bg-accent/20 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restore Default Programs
                  </button>
                )}
                <button
                  onClick={() => setIsTrashOpen(true)}
                  className="relative rounded-full border border-border/60 bg-surface-1 px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-text hover:bg-surface-2 transition flex items-center gap-1.5"
                  title="View Trash & Recovered Items"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Trash
                  {trashItems.length > 0 && (
                    <span className="rounded-full bg-accent px-1.5 py-0.2 text-[10px] font-bold text-black">
                      {trashItems.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setEditingProgram(undefined);
                    setIsProgramEditorOpen(true);
                  }}
                  className="btn-hero flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold"
                >
                  <Plus className="h-4 w-4" /> Create Program
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {programs.map((prog) => (
                <Card
                  key={prog.id}
                  className={cn(
                    "p-5 space-y-4 border-2 transition-all",
                    prog.active
                      ? "border-accent bg-surface-1/90 shadow-md"
                      : "border-border/60 bg-surface-1/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-bold text-text">{prog.name}</h3>
                        {prog.active && (
                          <span className="rounded-full bg-accent/20 border border-accent/40 px-2.5 py-0.5 text-[10px] font-bold text-accent">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      {prog.description && (
                        <p className="mt-1 text-xs text-muted">{prog.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingProgram(prog);
                          setIsProgramEditorOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-faint hover:bg-surface-hover hover:text-text"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteProgram(prog.id)}
                        className="rounded-lg p-1.5 text-faint hover:bg-surface-hover hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sessions List */}
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <span className="text-[11px] font-semibold uppercase text-faint">
                      Sessions ({prog.sessions.length})
                    </span>
                    {prog.sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-surface-2/60 p-3 text-xs"
                      >
                        <div>
                          <span className="font-bold text-text">{sess.name}</span>
                          <p className="text-[11px] text-faint">
                            {sess.exercises.length} exercises · {sess.dayName}
                          </p>
                        </div>

                        <button
                          onClick={() => handleStartWorkout(sess)}
                          className="flex items-center gap-1 rounded-lg bg-accent/15 px-3 py-1.5 text-[11px] font-bold text-accent hover:bg-accent hover:text-accent-fg transition-colors"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" /> Start
                        </button>
                      </div>
                    ))}
                  </div>

                  {!prog.active && (
                    <button
                      onClick={() => setActiveProgram(prog.id)}
                      className="w-full rounded-xl border border-border bg-surface-2 py-2 text-xs font-semibold text-muted hover:text-text hover:bg-surface-hover transition-colors"
                    >
                      Set as Active Program
                    </button>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: PROGRESS & PRS */}
        {activeTab === "progress" && <ProgressCharts />}
      </div>

      {/* Program Builder Modal */}
      <ProgramEditorModal
        key={editingProgram?.id ?? "new"}
        open={isProgramEditorOpen}
        program={editingProgram}
        onClose={() => setIsProgramEditorOpen(false)}
      />

      {/* Trash Modal */}
      <TrashModal open={isTrashOpen} onClose={() => setIsTrashOpen(false)} />

      {/* Program Picker Modal */}
      <ProgramPickerModal
        open={isProgramPickerOpen}
        sport={pickerSport}
        onClose={() => setIsProgramPickerOpen(false)}
        onSelectSession={(sess, sportOverride) => handleStartWorkout(sess, sportOverride)}
        onCreateProgramClick={() => {
          setEditingProgram(undefined);
          setIsProgramEditorOpen(true);
        }}
      />

      {/* Sleep Logger Modal */}
      <SleepLoggerModal
        open={isSleepModalOpen}
        onClose={() => setIsSleepModalOpen(false)}
      />

      {/* Weight Logger Modal */}
      <WeightLoggerModal
        open={isWeightModalOpen}
        onClose={() => setIsWeightModalOpen(false)}
      />

      {/* Daily Recovery Modal */}
      <Modal open={loggingDay} onClose={() => setLoggingDay(false)} title="Log Daily Health & Recovery">
        <form onSubmit={handleSaveDay} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Steps Today">
              <input
                type="number"
                value={stepsInput}
                onChange={(e) => setStepsInput(e.target.value)}
                placeholder="8000"
                className={inputCls}
              />
            </Field>

            <Field label="Sleep (Hours)">
              <input
                type="number"
                step="0.5"
                value={sleepInput}
                onChange={(e) => setSleepInput(e.target.value)}
                placeholder="8"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Water (Cups)">
              <input
                type="number"
                value={waterInput}
                onChange={(e) => setWaterInput(e.target.value)}
                placeholder="8"
                className={inputCls}
              />
            </Field>

            <Field label="Bodyweight (kg)">
              <input
                type="number"
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder="75.0"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Soreness (1-5)">
              <select
                value={sorenessInput}
                onChange={(e) => setSorenessInput(Number(e.target.value))}
                className={inputCls}
              >
                <option value={1}>1 - Fully Recovered</option>
                <option value={2}>2 - Mild</option>
                <option value={3}>3 - Moderate</option>
                <option value={4}>4 - High Soreness</option>
                <option value={5}>5 - Severe Fatigue</option>
              </select>
            </Field>

            <Field label="Energy (1-5)">
              <select
                value={energyInput}
                onChange={(e) => setEnergyInput(Number(e.target.value))}
                className={inputCls}
              >
                <option value={1}>1 - Very Low</option>
                <option value={2}>2 - Low</option>
                <option value={3}>3 - Normal</option>
                <option value={4}>4 - High Energy</option>
                <option value={5}>5 - Peak Performance</option>
              </select>
            </Field>
          </div>

          <FormFooter onCancel={() => setLoggingDay(false)} submitLabel="Save Day Stats" />
        </form>
      </Modal>
    </Hydrate>
  );
}
