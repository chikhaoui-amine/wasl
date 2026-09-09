"use client";

import { useState, useRef, useEffect } from "react";
import {
  FolderInput,
  Download,
  Trash2,
  X,
  CheckSquare,
  Square,
  AlertTriangle,
  ChevronUp,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { NoteCategory } from "@/lib/data/domains/notes";
import { cn } from "@/lib/utils";

interface NotesBulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onDeleteSelected: () => Promise<void> | void;
  onMoveCategory: (targetCategory: string) => Promise<void> | void;
  onExportSelected: () => Promise<void> | void;
  onExitSelection: () => void;
  categories: NoteCategory[];
}

export function NotesBulkActionBar({
  selectedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  onDeleteSelected,
  onMoveCategory,
  onExportSelected,
  onExitSelection,
  categories,
}: NotesBulkActionBarProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const moveMenuRef = useRef<HTMLDivElement>(null);

  // Close move dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moveMenuRef.current && !moveMenuRef.current.contains(event.target as Node)) {
        setShowMoveMenu(false);
      }
    }
    if (showMoveMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMoveMenu]);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteSelected();
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExportSelected();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[92vw] z-40 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="relative flex items-center gap-1.5 sm:gap-2 rounded-full border border-border/80 bg-surface-1/95 p-1.5 pl-3 pr-2 shadow-2xl backdrop-blur-xl">
          {/* Select All / Deselect Toggle Button */}
          <button
            type="button"
            onClick={onToggleSelectAll}
            title={allSelected ? "Deselect all" : `Select all (${totalCount})`}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-text hover:bg-surface-2 transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 text-accent" />
            ) : (
              <Square className="h-4 w-4 text-faint" />
            )}
            <span className="hidden sm:inline">
              {allSelected ? "Deselect" : "Select All"}
            </span>
          </button>

          {/* Selected Count Indicator */}
          <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent whitespace-nowrap">
            {selectedCount} {selectedCount === 1 ? "note" : "notes"}
          </span>

          <div className="h-4 w-px bg-border/80 mx-0.5" />

          {/* Action: Move Category */}
          <div className="relative" ref={moveMenuRef}>
            <button
              type="button"
              onClick={() => setShowMoveMenu((prev) => !prev)}
              disabled={selectedCount === 0}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors",
                selectedCount === 0
                  ? "opacity-50 cursor-not-allowed text-faint"
                  : "text-muted hover:bg-surface-2 hover:text-text",
              )}
              title="Move selected notes to another category"
            >
              <FolderInput className="h-3.5 w-3.5 text-accent" />
              <span className="hidden sm:inline">Move</span>
              <ChevronUp className="h-3 w-3 text-faint" />
            </button>

            {/* Move Category Popover */}
            {showMoveMenu && (
              <div className="absolute bottom-full mb-2 left-0 min-w-[190px] rounded-2xl border border-border/80 bg-surface-1/95 p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-faint">
                  Move to Page:
                </div>
                <div className="max-h-56 overflow-y-auto space-y-0.5 scrollbar-thin">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        onMoveCategory(cat.name);
                        setShowMoveMenu(false);
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-text hover:bg-surface-2 transition-colors"
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: cat.color || "var(--accent)" }}
                      />
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action: Export */}
          <button
            type="button"
            onClick={handleExport}
            disabled={selectedCount === 0 || isExporting}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors",
              selectedCount === 0 || isExporting
                ? "opacity-50 cursor-not-allowed text-faint"
                : "text-muted hover:bg-surface-2 hover:text-text",
            )}
            title={
              selectedCount > 1
                ? "Export selected notes as .zip"
                : "Export selected note as .md"
            }
          >
            <Download className="h-3.5 w-3.5 text-accent" />
            <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export"}</span>
          </button>

          {/* Action: Delete to Trash */}
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={selectedCount === 0}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors",
              selectedCount === 0
                ? "opacity-50 cursor-not-allowed text-faint"
                : "text-rose-500 hover:bg-rose-500/10",
            )}
            title="Move selected notes to Trash"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>

          <div className="h-4 w-px bg-border/80 mx-0.5" />

          {/* Exit Selection Mode Button */}
          <button
            type="button"
            onClick={onExitSelection}
            title="Exit selection mode (Esc)"
            aria-label="Exit selection mode"
            className="grid h-7 w-7 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={
          <span className="flex items-center gap-2 text-rose-500">
            <AlertTriangle className="h-4 w-4" /> Move to Trash
          </span>
        }
        size="sm"
      >
        <div className="space-y-4 p-4 text-sm text-text">
          <p>
            Are you sure you want to move <strong>{selectedCount}</strong>{" "}
            {selectedCount === 1 ? "note" : "notes"} to Trash?
          </p>
          <p className="text-xs text-faint">
            You can restore these notes at any time from <em>Settings → Trash</em>.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="rounded-full bg-rose-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Moving..." : "Move to Trash"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
