"use client";

import { useState, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { useBlocksData, type Block } from "@/lib/data/domains/blocks";
import { exportBlocksToIcs, parseIcsToBlocks } from "@/lib/calendar/ics-utils";
import { Download, Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { todayISO } from "@/lib/date";

export function IcsImportExportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { blocks, importBlocks } = useBlocksData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);
  const [parsedBlocks, setParsedBlocks] = useState<Block[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleExport = () => {
    try {
      const icsData = exportBlocksToIcs(blocks);
      const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wasl-calendar-${todayISO()}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage({ type: "success", text: `Exported ${blocks.length} events successfully.` });
    } catch {
      setStatusMessage({ type: "error", text: "Failed to export calendar to .ics file." });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatusMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file content");
        const parsed = parseIcsToBlocks(text);
        if (parsed.length === 0) {
          setStatusMessage({ type: "error", text: "No valid calendar events (VEVENT) found in this file." });
          setParsedBlocks(null);
        } else {
          setParsedBlocks(parsed);
          setStatusMessage({ type: "success", text: `Found ${parsed.length} event(s) ready to import.` });
        }
      } catch {
        setStatusMessage({ type: "error", text: "Failed to parse iCalendar file." });
        setParsedBlocks(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!parsedBlocks || parsedBlocks.length === 0) return;
    setImporting(true);
    try {
      await importBlocks(parsedBlocks);
      setStatusMessage({
        type: "success",
        text: `Successfully imported ${parsedBlocks.length} event(s) into your calendar!`,
      });
      setParsedBlocks(null);
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setStatusMessage({ type: "error", text: "Failed to save imported calendar events." });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="iCalendar (.ics) Interoperability">
      <div className="space-y-6 pt-2">
        {/* Status banner */}
        {statusMessage && (
          <div
            className={`flex items-center gap-2 rounded-lg p-3 text-xs font-medium ${
              statusMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                : "bg-red-500/10 text-red-500 border border-red-500/20"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Export Section */}
        <div className="rounded-xl border border-border bg-surface-1 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                <Download className="h-4 w-4 text-accent" /> Export Calendar
              </h3>
              <p className="mt-1 text-xs text-muted">
                Export your {blocks.length} WASL time blocks as a standard RFC 5545 `.ics` file for Apple Calendar, Google Calendar, or Outlook.
              </p>
            </div>
            <button
              onClick={handleExport}
              className="shrink-0 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-text border border-border hover:bg-surface-hover transition-colors"
            >
              Export .ics
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <Upload className="h-4 w-4 text-accent" /> Import Calendar
            </h3>
            <p className="mt-1 text-xs text-muted">
              Import `.ics` files exported from Google Calendar, Apple Calendar, or other tools directly into WASL.
            </p>
          </div>

          <input
            type="file"
            accept=".ics,text/calendar"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center cursor-pointer hover:border-accent/50 hover:bg-surface-2/50 transition-colors"
          >
            <FileText className="h-6 w-6 text-muted" />
            <div className="text-xs font-medium text-text">
              {fileName ? fileName : "Click to select a .ics file"}
            </div>
            <p className="text-[11px] text-faint">Standard iCalendar (.ics) format</p>
          </div>

          {parsedBlocks && parsedBlocks.length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted">
                Ready to merge <strong>{parsedBlocks.length}</strong> event(s)
              </span>
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {importing ? "Importing..." : "Confirm Import"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
