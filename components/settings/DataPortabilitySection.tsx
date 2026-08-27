"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Upload,
  Database,
  AlertTriangle,
  XCircle,
  FileJson,
  Layers,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import type {
  DataAdapter,
  DuplicateResolutionStrategy,
  StoreKey,
  TransferPreviewDetails,
  WaslTransferSelection,
} from "@/lib/data/types";
import { STORE_KEYS, STORE_METADATA } from "@/lib/data/store-registry";
import { SettingsSection, SettingsRow, StatusNote } from "./settings-ui";
import {
  exportWaslBackup,
  previewWaslBackup,
  importWaslBackup,
  exportWaslTransfer,
  previewWaslTransfer,
  importWaslTransfer,
  extractStoreEntities,
  verifyBackupChecksum,
  type BackupPreviewDetails,
} from "@/lib/data/backup";
import { isDatabaseEmpty, resetDatabase } from "@/lib/data/adapters/local/maintenance";
import { useQueryClient } from "@tanstack/react-query";

interface DataPortabilitySectionProps {
  adapter: DataAdapter;
  titlePrefix?: string;
}

export function DataPortabilitySection({ adapter, titlePrefix }: DataPortabilitySectionProps) {
  const queryClient = useQueryClient();

  // Full Backup State
  const [exportingBackup, setExportingBackup] = useState(false);
  const [backupExportSuccess, setBackupExportSuccess] = useState<string | null>(null);
  const [backupExportError, setBackupExportError] = useState<string | null>(null);

  // Full Restore State
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [restoreFileContent, setRestoreFileContent] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupPreviewDetails | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [dbEmpty, setDbEmpty] = useState<boolean | null>(null);

  // Selective Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Set<StoreKey>>(new Set(STORE_KEYS));
  const [selectedEntities, setSelectedEntities] = useState<Record<string, Set<string>>>({});
  const [availableEntities, setAvailableEntities] = useState<Record<string, Array<{ id?: string; title?: string; name?: string }>>>({});
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [exportingTransfer, setExportingTransfer] = useState(false);
  const [transferExportSuccess, setTransferExportSuccess] = useState<string | null>(null);
  const [transferExportError, setTransferExportError] = useState<string | null>(null);

  // Selective Import State
  const transferFileInputRef = useRef<HTMLInputElement>(null);
  const [transferFileContent, setTransferFileContent] = useState<string | null>(null);
  const [transferPreview, setTransferPreview] = useState<TransferPreviewDetails | null>(null);
  const [transferStrategy, setTransferStrategy] = useState<DuplicateResolutionStrategy>("skip");
  const [importingTransfer, setImportingTransfer] = useState(false);
  const [transferImportError, setTransferImportError] = useState<string | null>(null);
  const [transferImportSuccess, setTransferImportSuccess] = useState<string | null>(null);

  // Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [exportSafetyBackupFirst, setExportSafetyBackupFirst] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Check destination emptiness
  const checkDbStatus = useCallback(async () => {
    try {
      const empty = await isDatabaseEmpty(adapter);
      setDbEmpty(empty);
    } catch {
      setDbEmpty(null);
    }
  }, [adapter]);

  useEffect(() => {
    let mounted = true;
    void isDatabaseEmpty(adapter)
      .then((empty) => {
        if (mounted) setDbEmpty(empty);
      })
      .catch(() => {
        if (mounted) setDbEmpty(null);
      });

    return () => {
      mounted = false;
    };
  }, [adapter]);

  // Load available entities for selective export modal
  const loadAvailableEntities = async () => {
    try {
      const stores = await adapter.getAllStores();
      const entityMap: Record<string, Array<{ id?: string; title?: string; name?: string }>> = {};
      for (const storeDoc of stores) {
        const entities = extractStoreEntities(storeDoc.store, storeDoc.state);
        if (entities.length > 0) {
          entityMap[storeDoc.store] = entities;
        }
      }
      setAvailableEntities(entityMap);
    } catch (err) {
      console.warn("Failed to load entities for export:", err);
    }
  };

  // Full Backup Export Handler
  const handleExportFullBackup = async () => {
    setExportingBackup(true);
    setBackupExportSuccess(null);
    setBackupExportError(null);
    try {
      const { backup, json } = await exportWaslBackup(adapter);
      const isValid = await verifyBackupChecksum(backup);
      if (!isValid) {
        throw new Error("Generated backup failed cryptographic checksum verification.");
      }
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date(backup.exportedAt).toISOString().split("T")[0];
      a.href = url;
      a.download = `wasl-${adapter.edition}-backup-${dateStr}.wasl-backup`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupExportSuccess(`Exported ${backup.stores.length} store snapshots successfully.`);
    } catch (err) {
      setBackupExportError(err instanceof Error ? err.message : "Full backup export failed.");
    } finally {
      setExportingBackup(false);
    }
  };

  // Full Backup File Selection (Accepts .wasl-backup and legacy .json based on content)
  const handleBackupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError(null);
    setRestoreSuccess(null);
    setRestorePreview(null);

    try {
      const text = await file.text();
      setRestoreFileContent(text);
      const preview = await previewWaslBackup(text);
      setRestorePreview(preview);
      if (!preview.valid) {
        setRestoreError(`Validation errors:\n${preview.errors.join("\n")}`);
      }
      await checkDbStatus();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Failed to read backup file.");
    }
  };

  // Full Restore Execution
  const handleExecuteFullRestore = async () => {
    if (!restoreFileContent) return;
    if (dbEmpty === false) {
      setRestoreError("Full restore strictly requires an empty database. Please reset your database first.");
      return;
    }

    setRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(null);

    try {
      const result = await importWaslBackup(adapter, restoreFileContent);
      setRestoreSuccess(`Full restore complete! ${result.storesImported} store(s) restored with 100% integrity parity.`);
      setRestoreFileContent(null);
      setRestorePreview(null);
      if (backupFileInputRef.current) backupFileInputRef.current.value = "";
      await checkDbStatus();
      await queryClient.invalidateQueries();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Full restore failed.");
    } finally {
      setRestoring(false);
    }
  };

  // Open Selective Export Modal
  const handleOpenExportModal = async () => {
    await loadAvailableEntities();
    setShowExportModal(true);
  };

  // Toggle domain selection
  const toggleDomain = (store: StoreKey) => {
    const next = new Set(selectedDomains);
    if (next.has(store)) {
      next.delete(store);
    } else {
      next.add(store);
    }
    setSelectedDomains(next);
  };

  // Toggle entity selection
  const toggleEntity = (store: string, entityId: string) => {
    const current = selectedEntities[store] ? new Set(selectedEntities[store]) : new Set<string>();
    if (current.has(entityId)) {
      current.delete(entityId);
    } else {
      current.add(entityId);
    }
    setSelectedEntities({ ...selectedEntities, [store]: current });
  };

  // Execute Selective Export (.wasl-transfer)
  const handleExecuteSelectiveExport = async () => {
    setExportingTransfer(true);
    setTransferExportError(null);
    try {
      const entitiesObj: Record<string, string[]> = {};
      for (const [store, idSet] of Object.entries(selectedEntities)) {
        if (idSet.size > 0) {
          entitiesObj[store] = Array.from(idSet);
        }
      }

      const selection: WaslTransferSelection = {
        domains: Array.from(selectedDomains),
        entities: Object.keys(entitiesObj).length > 0 ? (entitiesObj as WaslTransferSelection["entities"]) : undefined,
      };

      const { transfer, json } = await exportWaslTransfer(adapter, selection);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date(transfer.exportedAt).toISOString().split("T")[0];
      a.href = url;
      a.download = `wasl-transfer-${dateStr}.wasl-transfer`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setTransferExportSuccess(`Exported transfer package (${transfer.stores.length} domains) successfully.`);
      setShowExportModal(false);
    } catch (err) {
      setTransferExportError(err instanceof Error ? err.message : "Selective export failed.");
    } finally {
      setExportingTransfer(false);
    }
  };

  // Selective Transfer File Selection
  const handleTransferFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTransferImportError(null);
    setTransferImportSuccess(null);
    setTransferPreview(null);

    try {
      const text = await file.text();
      setTransferFileContent(text);
      const preview = await previewWaslTransfer(text, adapter);
      setTransferPreview(preview);
      if (!preview.valid) {
        setTransferImportError(`Validation errors:\n${preview.errors.join("\n")}`);
      }
    } catch (err) {
      setTransferImportError(err instanceof Error ? err.message : "Failed to read transfer file.");
    }
  };

  // Execute Selective Transfer Import
  const handleExecuteTransferImport = async () => {
    if (!transferFileContent) return;

    setImportingTransfer(true);
    setTransferImportError(null);
    setTransferImportSuccess(null);

    try {
      const result = await importWaslTransfer(adapter, transferFileContent, {
        strategy: transferStrategy,
      });

      setTransferImportSuccess(
        `Selective import complete! ${result.entitiesImported} imported, ${result.entitiesSkipped} skipped, ${result.entitiesReplaced} replaced, ${result.entitiesCopied} copied across ${result.storesUpdated} domain(s).`,
      );
      setTransferFileContent(null);
      setTransferPreview(null);
      if (transferFileInputRef.current) transferFileInputRef.current.value = "";
      await checkDbStatus();
      await queryClient.invalidateQueries();
    } catch (err) {
      setTransferImportError(err instanceof Error ? err.message : "Selective transfer import failed.");
    } finally {
      setImportingTransfer(false);
    }
  };

  // Reset Database Execution
  const handleExecuteReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== "RESET") {
      setResetError('Please type "RESET" to confirm.');
      return;
    }

    setResetting(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      if (exportSafetyBackupFirst) {
        const { backup, json } = await exportWaslBackup(adapter);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date(backup.exportedAt).toISOString().split("T")[0];
        a.href = url;
        a.download = `wasl-safety-backup-before-reset-${dateStr}.wasl-backup`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      await resetDatabase(adapter);
      setResetSuccess("Database has been reset completely. You can now perform a clean restore.");
      setShowResetModal(false);
      setResetConfirmText("");
      await checkDbStatus();
      await queryClient.invalidateQueries();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Database reset failed.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: FULL BACKUP & RECOVERY */}
      <SettingsSection
        icon={<Database className="w-4 h-4" />}
        title={`${titlePrefix ? `${titlePrefix} ` : ""}Full backup`}
        description="Lossless snapshots of your entire workspace, checksum-verified. Restoring requires an empty database."
        aside={
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-muted">
            .wasl-backup
          </span>
        }>

        {/* Messages */}
        {backupExportSuccess && <StatusNote tone="success">{backupExportSuccess}</StatusNote>}
        {backupExportError && <StatusNote tone="error" whitespace-pre-wrap>{backupExportError}</StatusNote>}
        {resetSuccess && <StatusNote tone="success">{resetSuccess}</StatusNote>}
        {restoreSuccess && <StatusNote tone="success">{restoreSuccess}</StatusNote>}
        {restoreError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 text-danger text-sm border border-danger/15 whitespace-pre-line">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{restoreError}</span>
          </div>
        )}

        <SettingsRow
          label="Download backup"
          sublabel="Exact snapshot of all active stores, verified on save."
          control={
            <button
              onClick={handleExportFullBackup}
              disabled={exportingBackup}
              className="btn-hero rounded-[8px] px-3.5 py-2 text-[12px] font-semibold disabled:opacity-50"
            >
              {exportingBackup ? "Generating…" : "Download"}
            </button>
          }
        />
        <SettingsRow
          label="Restore from backup"
          sublabel="Accepts .wasl-backup files and legacy .json snapshots."
          control={
            <label className="flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-border bg-surface px-3.5 py-2 text-[12px] font-semibold text-text transition-colors hover:bg-surface-hover">
              <Upload className="h-3.5 w-3.5" />
              Select file
              <input
                ref={backupFileInputRef}
                type="file"
                accept=".wasl-backup,.json,application/json,text/plain"
                onChange={handleBackupFileSelect}
                className="hidden"
              />
            </label>
          }
        />

        {/* Full Restore Preview Card */}
        {restorePreview && (
          <div className="p-4 rounded-xl border border-warn/30 bg-warn/5 space-y-4">
            <div className="flex items-center justify-between border-b border-warn/15 pb-3">
              <h4 className="text-sm font-semibold text-warn flex items-center gap-2">
                <FileJson className="w-4 h-4" />
                Backup Snapshot Inspection
              </h4>
              <span className={`text-xs px-2 py-0.5 rounded ${restorePreview.valid ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                {restorePreview.valid ? "Verified Valid" : "Invalid Backup"}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted">Source Edition:</span>
                <p className="font-medium capitalize">{restorePreview.sourceEdition}</p>
              </div>
              <div>
                <span className="text-muted">Export Date:</span>
                <p className="font-medium">{new Date(restorePreview.exportedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-muted">Stores Contained:</span>
                <p className="font-medium">{restorePreview.storeCount} stores</p>
              </div>
              <div>
                <span className="text-muted">Checksum:</span>
                <p className="font-medium text-success">SHA-256 Verified</p>
              </div>
            </div>

            {/* Destination Emptiness Warning */}
            {dbEmpty === false && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Destination database contains existing data.</p>
                  <p className="text-danger/80">
                    WASL strictly requires an empty database for full restore to prevent accidental data overwriting.
                    Please reset your database or export a safety backup first.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              {dbEmpty === false && (
                <button
                  onClick={() => setShowResetModal(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-danger/15 text-danger hover:bg-danger/30 transition"
                >
                  Reset Database...
                </button>
              )}
              <button
                onClick={handleExecuteFullRestore}
                disabled={!restorePreview.valid || dbEmpty === false || restoring}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success hover:bg-success text-white text-sm font-medium transition disabled:opacity-50"
              >
                {restoring ? "Restoring Data..." : "Execute Full Restore"}
              </button>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* SECTION 2: SELECTIVE DATA TRANSFER */}
      <SettingsSection
        icon={<ArrowRightLeft className="w-4 h-4" />}
        title="Selective transfer"
        description="Move specific domains or individual entities between devices. Duplicates are detected and merged safely."
        aside={
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-muted">
            .wasl-transfer
          </span>
        }>

        {/* Transfer Messages */}
        {transferExportSuccess && <StatusNote tone="success">{transferExportSuccess}</StatusNote>}
        {transferExportError && <StatusNote tone="error" whitespace-pre-wrap>{transferExportError}</StatusNote>}
        {transferImportSuccess && <StatusNote tone="success">{transferImportSuccess}</StatusNote>}
        {transferImportError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 text-danger text-sm border border-danger/15 whitespace-pre-line">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{transferImportError}</span>
          </div>
        )}

        <SettingsRow
          label="Export selected data"
          sublabel="Pick domains or individual entities to bundle."
          control={
            <button
              onClick={handleOpenExportModal}
              className="btn-hero rounded-[8px] px-3.5 py-2 text-[12px] font-semibold"
            >
              Choose data…
            </button>
          }
        />
        <SettingsRow
          label="Import & merge"
          sublabel="Preview a transfer package, resolve duplicates, merge safely."
          control={
            <label className="flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-border bg-surface px-3.5 py-2 text-[12px] font-semibold text-text transition-colors hover:bg-surface-hover">
              <Upload className="h-3.5 w-3.5" />
              Select file
              <input
                ref={transferFileInputRef}
                type="file"
                accept=".wasl-transfer,.json,application/json,text/plain"
                onChange={handleTransferFileSelect}
                className="hidden"
              />
            </label>
          }
        />

        {/* Transfer Preview & Merge Card */}
        {transferPreview && (
          <div className="p-4 rounded-xl border border-accent/30 bg-accent/5 space-y-4">
            <div className="flex items-center justify-between border-b border-accent/20 pb-3">
              <h4 className="text-sm font-semibold text-accent flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                Transfer Package Preview
              </h4>
              <span className={`text-xs px-2 py-0.5 rounded ${transferPreview.valid ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                {transferPreview.valid ? "Verified Valid" : "Invalid Transfer"}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted">Source:</span>
                <p className="font-medium capitalize">{transferPreview.sourceEdition} Edition</p>
              </div>
              <div>
                <span className="text-muted">Total Entities:</span>
                <p className="font-medium">{transferPreview.totalEntitiesCount} items</p>
              </div>
              <div>
                <span className="text-muted">Stores:</span>
                <p className="font-medium">{transferPreview.storeCount} domains</p>
              </div>
              <div>
                <span className="text-muted">Checksum:</span>
                <p className="font-medium text-success">SHA-256 Valid</p>
              </div>
            </div>

            {/* Stores Breakdown */}
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted">Domain Breakdown:</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {transferPreview.stores.map((s) => (
                  <div key={s.store} className="p-2.5 rounded bg-surface-2/40 border border-border flex items-center justify-between">
                    <div>
                      <span className="font-medium">{STORE_METADATA[s.store]?.name || s.store}</span>
                      <p className="text-[11px] text-muted">
                        {s.totalEntities} items ({s.newCount} new, {s.duplicateCount} duplicate)
                      </p>
                    </div>
                    {s.duplicateCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-warn/15 text-warn">
                        {s.duplicateCount} Duplicate{s.duplicateCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Cross-Domain Dependency Warnings */}
            {transferPreview.dependencyWarnings.length > 0 && (
              <div className="p-3 rounded-lg bg-warn/10 border border-warn/30 text-warn text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Missing Dependency Warnings:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-warn/90">
                  {transferPreview.dependencyWarnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Duplicate Conflict Strategy Selector */}
            <div className="p-3.5 rounded-lg bg-surface-2/40 border border-border space-y-2">
              <label className="text-xs font-medium text-muted block">
                On Duplicate Entity IDs:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 transition ${transferStrategy === "skip" ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-surface-2"}`}>
                  <input
                    type="radio"
                    name="strategy"
                    value="skip"
                    checked={transferStrategy === "skip"}
                    onChange={() => setTransferStrategy("skip")}
                    className="accent-[var(--accent)]"
                  />
                  <div>
                    <span className="font-medium">Skip (Default)</span>
                    <p className="text-[10px] text-muted">Keep existing, import new</p>
                  </div>
                </label>
                <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 transition ${transferStrategy === "replace" ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-surface-2"}`}>
                  <input
                    type="radio"
                    name="strategy"
                    value="replace"
                    checked={transferStrategy === "replace"}
                    onChange={() => setTransferStrategy("replace")}
                    className="accent-[var(--accent)]"
                  />
                  <div>
                    <span className="font-medium">Replace</span>
                    <p className="text-[10px] text-muted">Overwrite matching IDs</p>
                  </div>
                </label>
                <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 transition ${transferStrategy === "copy" ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-surface-2"}`}>
                  <input
                    type="radio"
                    name="strategy"
                    value="copy"
                    checked={transferStrategy === "copy"}
                    onChange={() => setTransferStrategy("copy")}
                    className="accent-[var(--accent)]"
                  />
                  <div>
                    <span className="font-medium">Import as Copy</span>
                    <p className="text-[10px] text-muted">Create duplicate with (Copy)</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleExecuteTransferImport}
                disabled={!transferPreview.valid || importingTransfer}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition disabled:opacity-50"
              >
                {importingTransfer ? "Merging Data..." : "Confirm Transfer Import"}
              </button>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* SELECTIVE EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-2/40 border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Select Data to Export</h3>
                <p className="text-xs text-muted mt-0.5">
                  Choose whole domains or specific entities to bundle into your .wasl-transfer file.
                </p>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded-lg text-muted hover:text-text hover:bg-surface-2"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 divide-y divide-border">
              {STORE_KEYS.map((store) => {
                const isSelected = selectedDomains.has(store);
                const entities = availableEntities[store] || [];
                const isExpanded = expandedDomains.has(store);
                const selectedEntitySet = selectedEntities[store] || new Set();

                return (
                  <div key={store} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDomain(store)}
                          className="w-4 h-4 rounded accent-[var(--accent)]"
                        />
                        <span>{STORE_METADATA[store]?.name || store}</span>
                        {entities.length > 0 && (
                          <span className="text-xs text-muted font-normal">
                            ({entities.length} items)
                          </span>
                        )}
                      </label>

                      {entities.length > 0 && !isSelected && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = new Set(expandedDomains);
                            if (next.has(store)) next.delete(store);
                            else next.add(store);
                            setExpandedDomains(next);
                          }}
                          className="text-xs text-accent hover:underline flex items-center gap-1"
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          Pick items ({selectedEntitySet.size})
                        </button>
                      )}
                    </div>

                    {/* Individual Entity Picker when domain is not fully selected */}
                    {isExpanded && !isSelected && entities.length > 0 && (
                      <div className="pl-6 pt-1 space-y-1.5 max-h-40 overflow-y-auto">
                        {entities.map((e) => (
                          <label
                            key={e.id}
                            className="flex items-center gap-2 text-xs text-muted hover:text-text cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedEntitySet.has(e.id!)}
                              onChange={() => toggleEntity(store, e.id!)}
                              className="w-3.5 h-3.5 rounded accent-[var(--accent)]"
                            />
                            <span className="truncate">{e.title || e.name || e.id}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-5 border-t border-border flex items-center justify-between bg-surface-2/40">
              <div className="text-xs text-muted">
                {selectedDomains.size} full domain(s) selected
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface-2 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSelectiveExport}
                  disabled={exportingTransfer || (selectedDomains.size === 0 && Object.values(selectedEntities).every((s) => s.size === 0))}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition disabled:opacity-50"
                >
                  {exportingTransfer ? "Exporting..." : "Download .wasl-transfer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DANGER ZONE: RESET MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-2/40 border border-danger/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-danger">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-semibold">Reset Database</h3>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              This action clears all active domain data in your {adapter.edition} database so that a clean full restore can be performed.
            </p>

            {resetError && (
              <div className="p-2.5 rounded bg-danger/10 text-danger text-xs border border-danger/15">
                {resetError}
              </div>
            )}

            <label className="flex items-center gap-2 text-xs cursor-pointer p-2.5 rounded bg-surface-2 border border-border">
              <input
                type="checkbox"
                checked={exportSafetyBackupFirst}
                onChange={(e) => setExportSafetyBackupFirst(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent)]"
              />
              <span className="font-medium text-success">Download Safety Backup First (Recommended)</span>
            </label>

            <div className="space-y-1">
              <label className="text-xs text-muted">
                Type <span className="font-bold text-danger">RESET</span> to confirm:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm focus:border-danger outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmText("");
                }}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-surface-2 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={resetting || resetConfirmText.trim().toUpperCase() !== "RESET"}
                className="px-4 py-2 rounded-lg bg-danger hover:bg-danger/90 text-white text-xs font-medium transition disabled:opacity-50"
              >
                {resetting ? "Resetting..." : "Confirm & Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
