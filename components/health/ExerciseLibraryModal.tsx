"use client";

import { useState } from "react";
import { Search, Plus, Dumbbell, Zap, Footprints, Droplet, Flame, Check } from "lucide-react";
import { useHealthData, type Exercise } from "@/lib/data/domains/health";
import { Modal, Field, FormFooter, inputCls } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

const MUSCLE_GROUPS = [
  "All",
  "Chest",
  "Back",
  "Shoulders",
  "Quads",
  "Hamstrings",
  "Biceps",
  "Triceps",
  "Core",
  "Full Body",
  "Cardio",
];

const CATEGORIES: ("All" | Exercise["category"])[] = [
  "All",
  "Gym",
  "Calisthenics",
  "Running",
  "Swimming",
  "Boxing/Martial Arts",
];

interface ExerciseLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelectExercise: (ex: Exercise) => void;
}

export function ExerciseLibraryModal({
  open,
  onClose,
  onSelectExercise,
}: ExerciseLibraryModalProps) {
  const { exercises, addExercise } = useHealthData();
  const [search, setSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState<"All" | Exercise["category"]>("All");
  const [isCreating, setIsCreating] = useState(false);

  // New Custom Exercise state
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState<Exercise["category"]>("Gym");
  const [customMuscle, setCustomMuscle] = useState("Chest");
  const [customEquipment, setCustomEquipment] = useState("Barbell");
  const [customInstructions, setCustomInstructions] = useState("");

  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch =
      ex.name.toLowerCase().includes(search.toLowerCase()) ||
      ex.primaryMuscle.toLowerCase().includes(search.toLowerCase()) ||
      ex.equipment.toLowerCase().includes(search.toLowerCase());
    const matchesMuscle = selectedMuscle === "All" || ex.primaryMuscle === selectedMuscle;
    const matchesCategory = selectedCategory === "All" || ex.category === selectedCategory;
    return matchesSearch && matchesMuscle && matchesCategory;
  });

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const created = await addExercise({
      name: customName.trim(),
      category: customCategory,
      primaryMuscle: customMuscle,
      equipment: customEquipment,
      instructions: customInstructions,
    });
    setCustomName("");
    setCustomInstructions("");
    setIsCreating(false);
    onSelectExercise(created);
  };

  return (
    <Modal open={open} onClose={onClose} size="3xl" title="Exercise Library">
      {isCreating ? (
        <form onSubmit={handleCreateCustom} className="space-y-4 py-1">
          <Field label="Exercise Name">
            <input
              type="text"
              required
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Incline Cable Fly"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as Exercise["category"])}
                className={inputCls}
              >
                <option value="Gym">Gym</option>
                <option value="Calisthenics">Calisthenics</option>
                <option value="Running">Running</option>
                <option value="Swimming">Swimming</option>
                <option value="Boxing/Martial Arts">Boxing/Martial Arts</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            <Field label="Primary Muscle">
              <select
                value={customMuscle}
                onChange={(e) => setCustomMuscle(e.target.value)}
                className={inputCls}
              >
                {MUSCLE_GROUPS.filter((m) => m !== "All").map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Equipment">
              <input
                type="text"
                value={customEquipment}
                onChange={(e) => setCustomEquipment(e.target.value)}
                placeholder="e.g. Barbell, Cable, Bodyweight"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Form Cues / Instructions (Optional)">
            <textarea
              rows={2}
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Key execution points..."
              className={inputCls}
            />
          </Field>

          <FormFooter
            onCancel={() => setIsCreating(false)}
            submitLabel="Save & Select Exercise"
          />
        </form>
      ) : (
        <div className="space-y-4">
          {/* Top Controls: Search & Custom button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exercises, muscles, equipment..."
                className={cn(inputCls, "pl-9")}
              />
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[12px] font-semibold text-accent hover:bg-surface-hover transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" /> Custom
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-medium whitespace-nowrap transition-colors",
                  selectedCategory === cat
                    ? "bg-accent text-accent-fg font-semibold"
                    : "bg-surface-2 text-muted hover:text-text",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Muscle Group Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-border/40">
            {MUSCLE_GROUPS.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMuscle(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors",
                  selectedMuscle === m
                    ? "bg-surface-hover text-accent font-semibold"
                    : "text-faint hover:text-muted",
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Exercise List */}
          <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
            {filteredExercises.length === 0 ? (
              <div className="py-8 text-center text-sm text-faint">
                No exercises found matching filters.
              </div>
            ) : (
              filteredExercises.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => {
                    onSelectExercise(ex);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-1/60 p-3 text-left transition-all hover:bg-surface-hover hover:border-accent/40 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[13px] text-text group-hover:text-accent transition-colors">
                        {ex.name}
                      </span>
                      {ex.isCustom && (
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                      <span className="font-medium text-accent/80">{ex.primaryMuscle}</span>
                      <span>•</span>
                      <span>{ex.equipment}</span>
                      <span>•</span>
                      <span className="text-faint">{ex.category}</span>
                    </div>
                    {ex.instructions && (
                      <p className="mt-1 text-[11px] text-faint line-clamp-1">
                        {ex.instructions}
                      </p>
                    )}
                  </div>
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-faint group-hover:bg-accent group-hover:text-accent-fg transition-colors">
                    <Plus className="h-4 w-4" />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
