"use client";

import { useState } from "react";
import {
  type StudyModule,
  type StudyChecklistItem,
  type ChecklistCategory,
  calculateModuleReadiness,
} from "@/lib/data/domains/studies";
import { ProgressBar } from "@/components/ui/primitives";
import {
  BookOpen,
  FileSpreadsheet,
  Terminal,
  Award,
  Check,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface RevisionRoadmapProps {
  modules: StudyModule[];
  checklist: StudyChecklistItem[];
  onToggleItem: (itemId: string) => Promise<void>;
  onAddItem: (input: {
    moduleId: string;
    category: ChecklistCategory;
    title: string;
    url?: string;
  }) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onEditModule: (module: StudyModule) => void;
  onDeleteModule: (moduleId: string) => Promise<void>;
}

const CATEGORY_TABS: { key: ChecklistCategory | "all"; label: string; icon: typeof BookOpen }[] = [
  { key: "all", label: "All Items", icon: BookOpen },
  { key: "cours", label: "Cours", icon: BookOpen },
  { key: "td_series", label: "TD Series", icon: FileSpreadsheet },
  { key: "tp", label: "TPs & Labs", icon: Terminal },
  { key: "annale", label: "Annales (EMDs)", icon: Award },
];

export function RevisionRoadmap({
  modules,
  checklist,
  onToggleItem,
  onAddItem,
  onDeleteItem,
  onEditModule,
  onDeleteModule,
}: RevisionRoadmapProps) {
  const [activeCategory, setActiveCategory] = useState<ChecklistCategory | "all">("all");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    // Expand first 3 modules by default
    const initial: Record<string, boolean> = {};
    modules.slice(0, 3).forEach((m) => {
      initial[m.id] = true;
    });
    return initial;
  });

  const [addingForModule, setAddingForModule] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<ChecklistCategory>("cours");
  const [newItemUrl, setNewItemUrl] = useState("");

  const toggleExpand = (modId: string) => {
    setExpandedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleCreateItem = async (modId: string) => {
    if (!newItemTitle.trim()) return;
    await onAddItem({
      moduleId: modId,
      category: newItemCategory,
      title: newItemTitle.trim(),
      url: newItemUrl.trim() || undefined,
    });
    setNewItemTitle("");
    setNewItemUrl("");
    setAddingForModule(null);
  };

  return (
    <div className="space-y-4">
      {/* Category filter tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
          {CATEGORY_TABS.map((tab) => {
            const active = activeCategory === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveCategory(tab.key)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                  active
                    ? "bg-accent text-accent-fg shadow-sm"
                    : "bg-surface border border-border/70 text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-faint">
          {modules.length} Module(s)
        </span>
      </div>

      {/* Modules list */}
      <div className="space-y-3">
        {modules.map((m) => {
          const modItems = checklist.filter((item) => item.moduleId === m.id);
          const filteredItems = modItems.filter((item) => {
            if (activeCategory === "all") return true;
            return item.category === activeCategory;
          });

          const readiness = calculateModuleReadiness(modItems, m.id);
          const isExpanded = expandedModules[m.id] ?? true;
          const completedCount = modItems.filter((i) => i.completed).length;

          return (
            <div
              key={m.id}
              className="rounded-[18px] border border-border/70 bg-surface shadow-card overflow-hidden transition-all"
            >
              {/* Module Header Bar */}
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 gap-3 cursor-pointer hover:bg-surface-2/30 transition-colors"
                onClick={() => toggleExpand(m.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-text font-black text-xs"
                    style={{ backgroundColor: `${m.color}25`, color: m.color }}
                  >
                    {m.code.slice(0, 3)}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-sm sm:text-base font-bold text-text truncate">
                        {m.code} — {m.name}
                      </h3>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-muted border border-border/60">
                        Coeff {m.coefficient}
                      </span>
                    </div>

                    {/* Resources link pills */}
                    {m.resources && m.resources.length > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        {m.resources.map((res) => (
                          <a
                            key={res.id}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-accent hover:underline"
                          >
                            <span>{res.label}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress meter & controls */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 text-right">
                    <div className="w-24 sm:w-28">
                      <ProgressBar value={readiness} color={m.color} className="h-1.5" />
                    </div>
                    <span className="text-xs font-bold text-text tabular-nums">
                      {readiness}%
                    </span>
                    <span className="text-[10px] text-faint hidden md:inline">
                      ({completedCount}/{modItems.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-1 border-l border-border/60 pl-2">
                    <button
                      type="button"
                      onClick={() => onEditModule(m)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:text-text hover:bg-surface-2 transition-colors"
                      title="Edit module"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteModule(m.id)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Delete module"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(m.id)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsible Checklist Body */}
              {isExpanded && (
                <div className="border-t border-border/60 p-3 sm:p-4 bg-surface-2/15 space-y-3">
                  {filteredItems.length === 0 ? (
                    <p className="text-xs text-faint italic py-2">
                      No checklist items in this category yet. Click &quot;Add Item&quot; below.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {filteredItems.map((item) => {
                        return (
                          <div
                            key={item.id}
                            className={`group flex items-start justify-between gap-2.5 rounded-xl border p-2.5 transition-all text-xs ${
                              item.completed
                                ? "border-success/30 bg-success/5"
                                : "border-border/70 bg-surface hover:border-border-strong"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onToggleItem(item.id)}
                              className="flex items-start gap-2.5 text-left flex-1 min-w-0"
                            >
                              <span
                                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all mt-0.5 ${
                                  item.completed
                                    ? "border-success bg-success text-white shadow-sm"
                                    : "border-border-strong bg-surface text-transparent"
                                }`}
                              >
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>

                              <div className="min-w-0 flex-1">
                                <p className={`font-semibold leading-snug break-words ${item.completed ? "text-muted line-through" : "text-text"}`}>
                                  {item.title}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-faint mt-1">
                                  <span className="uppercase font-bold tracking-wider">
                                    {item.category === "cours" ? "Cours" : item.category === "td_series" ? "TD Série" : item.category === "tp" ? "TP Lab" : "Annale EMD"}
                                  </span>
                                  {item.url && (
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-0.5 text-accent hover:underline font-medium"
                                    >
                                      <span>Tresor link</span>
                                      <ExternalLink className="h-2 w-2" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 text-faint hover:text-danger transition-opacity p-1"
                              title="Delete item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Item form */}
                  {addingForModule === m.id ? (
                    <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text">New Checklist Item for {m.code}</span>
                        <button
                          type="button"
                          onClick={() => setAddingForModule(null)}
                          className="text-xs text-muted hover:text-text"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={newItemCategory}
                          onChange={(e) => setNewItemCategory(e.target.value as ChecklistCategory)}
                          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text outline-none"
                        >
                          <option value="cours">Cours (Lecture)</option>
                          <option value="td_series">TD Série (Sheet)</option>
                          <option value="tp">TP (Lab)</option>
                          <option value="annale">Annale (Past EMD)</option>
                        </select>

                        <input
                          type="text"
                          placeholder="e.g. Série 4: Arbres B+ ou EMD 2023"
                          value={newItemTitle}
                          onChange={(e) => setNewItemTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCreateItem(m.id);
                            }
                          }}
                          className="sm:col-span-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text outline-none placeholder:text-faint"
                          autoFocus
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <input
                          type="url"
                          placeholder="Resource URL / Tresor ESI link (optional)"
                          value={newItemUrl}
                          onChange={(e) => setNewItemUrl(e.target.value)}
                          className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text outline-none placeholder:text-faint"
                        />
                        <button
                          type="button"
                          onClick={() => handleCreateItem(m.id)}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-fg shadow-sm hover:opacity-90 transition-opacity"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingForModule(m.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/80 px-3 py-1.5 text-xs font-semibold text-muted hover:text-text hover:border-accent transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Chapter / Série / Annale</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
