"use client";

import { useEffect, useState } from "react";
import {
  HardDrive,
  Database,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Download,
  Sparkles,
} from "lucide-react";
import { useDataAdapter, useQueryClient } from "@/lib/data/query/provider";
import { useUI } from "@/lib/store";
import { LocalAdapter } from "@/lib/data/adapters/local/local-adapter";
import {
  requestPersistentStorage,
  isStoragePersisted,
  getStorageEstimate,
  type StorageEstimateResult,
} from "@/lib/data/adapters/local/storage";
import {
  resetLocalDatabase,
  isLocalDatabaseEmpty,
} from "@/lib/data/adapters/local/maintenance";
import {
  exportWaslBackup,
  verifyBackupChecksum,
  importWaslBackupToLocal,
  detectLegacyLocalStorage,
  convertLegacyStorageToBackup,
  type LegacyDetectionResult,
} from "@/lib/data/backup";
import { SettingsSection, SettingsRow, StatusNote } from "./settings-ui";
import { Modal, inputCls } from "@/components/ui/Modal";

/* ------------------------------------------------------------------ */
/* About WASL & Getting Started                                        */
/* ------------------------------------------------------------------ */

export function AboutWaslSection() {
  const setOnboardingOpen = useUI((s) => s.setOnboardingOpen);

  return (
    <SettingsSection
      icon={<Sparkles className="h-4 w-4" />}
      title="About WASL & Getting Started"
      description="Review the connected architecture, browser storage model, and AI setup."
    >
      <SettingsRow
        label="Welcome guide"
        sublabel="Revisit the initial introduction, data privacy guidance, and MCP capabilities."
        control={
          <button
            type="button"
            onClick={() => setOnboardingOpen(true)}
            className="flex items-center gap-1.5 rounded-[8px] border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text transition-colors hover:bg-surface-hover cursor-pointer"
          >
            Revisit welcome guide
          </button>
        }
      />
    </SettingsSection>
  );
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function downloadBackup(json: string, exportedAt: string, kind: "backup" | "safety-backup") {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date(exportedAt).toISOString().split("T")[0];
  a.href = url;
  a.download = `wasl-${kind}-${dateStr}.wasl-backup`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Storage & persistence                                               */
/* ------------------------------------------------------------------ */

export function StorageSection() {
  const adapter = useDataAdapter();

  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [estimate, setEstimate] = useState<StorageEstimateResult>({});
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);

  const refreshStorageDetails = async () => {
    setStorageLoading(true);
    try {
      const [isP, est] = await Promise.all([isStoragePersisted(), getStorageEstimate()]);
      setPersisted(isP);
      setEstimate(est);
    } catch {
      // ignore
    } finally {
      setStorageLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const isPersisted = await isStoragePersisted();
      const est = await getStorageEstimate();
      if (!active) return;
      setPersisted(isPersisted);
      setEstimate(est);
      setStorageLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [adapter]);

  const handleRequestPersistence = async () => {
    setStorageMessage(null);
    const granted = await requestPersistentStorage();
    setPersisted(granted);
    setStorageMessage(
      granted
        ? "Persistent storage granted by your browser."
        : "Browser did not grant persistence (depends on usage and bookmark status).",
    );
  };

  return (
    <SettingsSection
      icon={<HardDrive className="h-4 w-4" />}
      title="Storage"
      description="Your data lives in this browser's IndexedDB. Check usage and protect it from eviction."
      aside={
        <button
          onClick={refreshStorageDetails}
          disabled={storageLoading}
          aria-label="Refresh storage details"
          className="flex items-center gap-1 text-[12px] text-faint transition-colors hover:text-text"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${storageLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-[12px] bg-surface-2/60 px-3.5 py-3">
          <p className="text-[11px] font-medium text-faint">Used</p>
          <p className="tabular mt-1 text-[15px] font-semibold text-text">{formatBytes(estimate.usage)}</p>
        </div>
        <div className="rounded-[12px] bg-surface-2/60 px-3.5 py-3">
          <p className="text-[11px] font-medium text-faint">Quota</p>
          <p className="tabular mt-1 text-[15px] font-semibold text-text">{formatBytes(estimate.quota)}</p>
        </div>
        <div className="rounded-[12px] bg-surface-2/60 px-3.5 py-3">
          <p className="text-[11px] font-medium text-faint">Persistence</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            {persisted ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-[13px] font-semibold text-success">Protected</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-warn" />
                <span className="text-[13px] font-semibold text-warn">Best effort</span>
              </>
            )}
          </div>
        </div>
      </div>

      {!persisted && (
        <SettingsRow
          label="Request persistent storage"
          sublabel="Stops the browser from evicting your database under storage pressure."
          control={
            <button
              onClick={handleRequestPersistence}
              className="rounded-[8px] border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-text transition-colors hover:bg-surface-hover"
            >
              Enable
            </button>
          }
        />
      )}

      {storageMessage && <StatusNote tone="info">{storageMessage}</StatusNote>}
    </SettingsSection>
  );
}

/* ------------------------------------------------------------------ */
/* Legacy browser-data migration (shown only when detected)            */
/* ------------------------------------------------------------------ */

export function LegacyMigrationSection() {
  const adapter = useDataAdapter();
  const queryClient = useQueryClient();

  const [legacyResult] = useState<LegacyDetectionResult | null>(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      return detectLegacyLocalStorage(window.localStorage);
    }
    return null;
  });
  const [selectedScope, setSelectedScope] = useState<string>(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const legacy = detectLegacyLocalStorage(window.localStorage);
      return legacy.detectedScopes[0] ?? "";
    }
    return "";
  });
  const [migratingLegacy, setMigratingLegacy] = useState(false);
  const [legacySuccess, setLegacySuccess] = useState<string | null>(null);
  const [legacyError, setLegacyError] = useState<string | null>(null);

  if (!legacyResult || !legacyResult.hasLegacyData) return null;

  const handleMigrateLegacy = async () => {
    if (!adapter || !(adapter instanceof LocalAdapter) || typeof window === "undefined") return;

    const empty = await isLocalDatabaseEmpty(adapter);
    if (!empty) {
      setLegacyError("Local database must be empty to migrate legacy data. Reset it first (General tab).");
      return;
    }

    setMigratingLegacy(true);
    setLegacyError(null);
    setLegacySuccess(null);

    try {
      const { backup } = await convertLegacyStorageToBackup(window.localStorage, {
        selectedScope: legacyResult?.hasConflict ? selectedScope : undefined,
      });

      await importWaslBackupToLocal(backup, adapter);

      setLegacySuccess(`Migrated legacy data into the local database (${backup.stores.length} stores). Original localStorage was preserved.`);
      await queryClient.invalidateQueries();
    } catch (err) {
      setLegacyError(err instanceof Error ? err.message : "Legacy data migration failed.");
    } finally {
      setMigratingLegacy(false);
    }
  };

  return (
    <SettingsSection
      icon={<Database className="h-4 w-4" />}
      title="Found older WASL data in this browser"
      description="Previous localStorage data can be imported into your local database. The original copy stays untouched."
    >
      <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-[12px] bg-surface-2/60 px-3.5 py-3 text-[12px]">
        <span className="text-faint">
          Unscoped stores <span className="font-semibold text-text">{legacyResult.unscopedStores.length}</span>
        </span>
        <span className="text-faint">
          Profiles <span className="font-semibold text-text">{legacyResult.detectedScopes.length}</span>
        </span>
        <span className="text-faint">
          Archived stores <span className="font-semibold text-text">{legacyResult.archivedStores.length}</span>
        </span>
      </div>

      {legacyResult.hasConflict && (
        <fieldset className="space-y-1.5 rounded-[12px] border border-border bg-surface-2/40 px-3.5 py-3">
          <legend className="px-1 text-[12px] font-semibold text-text">Multiple profiles found — pick one</legend>
          {legacyResult.detectedScopes.map((scope) => (
            <label key={scope} className="flex cursor-pointer items-center gap-2 py-0.5 text-[12.5px] text-muted">
              <input
                type="radio"
                name="legacyScope"
                value={scope}
                checked={selectedScope === scope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="accent-[var(--accent)]"
              />
              <code className="font-mono text-text">{scope}</code>
              <span className="text-faint">({legacyResult.scopedStores[scope]?.length || 0} stores)</span>
            </label>
          ))}
        </fieldset>
      )}

      {legacyError && <StatusNote tone="error">{legacyError}</StatusNote>}
      {legacySuccess && <StatusNote tone="success">{legacySuccess}</StatusNote>}

      <div>
        <button
          onClick={handleMigrateLegacy}
          disabled={migratingLegacy || (legacyResult.hasConflict && !selectedScope)}
          className="btn-hero rounded-[10px] px-4 py-2 text-[13px] font-semibold disabled:opacity-40"
        >
          {migratingLegacy ? "Migrating…" : "Import legacy data"}
        </button>
      </div>
    </SettingsSection>
  );
}

/* ------------------------------------------------------------------ */
/* Danger zone                                                         */
/* ------------------------------------------------------------------ */

export function DangerZoneSection() {
  const adapter = useDataAdapter();
  const queryClient = useQueryClient();

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [exportSafetyBackupFirst, setExportSafetyBackupFirst] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!adapter) return;
    try {
      const { backup, json } = await exportWaslBackup(adapter);
      const isValidChecksum = await verifyBackupChecksum(backup);
      if (!isValidChecksum) {
        throw new Error("Generated backup failed cryptographic checksum verification.");
      }
      downloadBackup(json, backup.exportedAt, "backup");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Export failed.");
    }
  };

  const handleExecuteReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== "RESET" || !adapter) return;

    setResetting(true);
    setResetError(null);
    setResetSuccess(null);

    if (exportSafetyBackupFirst) {
      try {
        const { backup, json } = await exportWaslBackup(adapter);
        const isValidChecksum = await verifyBackupChecksum(backup);
        if (!isValidChecksum) {
          throw new Error("Generated backup failed cryptographic checksum verification.");
        }
        downloadBackup(json, backup.exportedAt, "safety-backup");
      } catch (exportErr) {
        setResetError(
          exportErr instanceof Error
            ? `Safety backup export failed: ${exportErr.message}. Reset aborted to protect your data.`
            : "Safety backup export failed. Reset aborted to protect your data.",
        );
        setResetting(false);
        return;
      }
    }

    try {
      await resetLocalDatabase(adapter);
      setResetSuccess("Local database has been completely reset to a clean state.");
      setShowResetModal(false);
      setResetConfirmText("");
      await queryClient.invalidateQueries();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <SettingsSection
      tone="danger"
      icon={<Trash2 className="h-4 w-4" />}
      title="Reset local database"
      description="Permanently erase every store in this browser's IndexedDB. Legacy localStorage is left untouched. A safety backup is offered first."
    >
      <SettingsRow
        label="Export a backup first"
        sublabel="Downloads a verified .wasl-backup snapshot."
        control={
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-[8px] border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text transition-colors hover:bg-surface-hover"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        }
      />
      <SettingsRow
        label="Erase everything"
        sublabel="Requires typing RESET to confirm."
        control={
          <button
            type="button"
            onClick={() => {
              setShowResetModal(true);
              setResetError(null);
            }}
            className="rounded-[8px] bg-danger/10 px-3 py-1.5 text-[12px] font-semibold text-danger transition-colors hover:bg-danger/20"
          >
            Reset…
          </button>
        }
      />

      {resetSuccess && <StatusNote tone="success">{resetSuccess}</StatusNote>}
      {resetError && !showResetModal && <StatusNote tone="error">{resetError}</StatusNote>}

      <Modal
        open={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setResetConfirmText("");
          setResetError(null);
        }}
        title="Confirm database reset"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-muted">
            This erases all active documents in your local IndexedDB. Legacy localStorage keys are not touched.
          </p>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={exportSafetyBackupFirst}
              onChange={(e) => setExportSafetyBackupFirst(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span className="text-[12.5px] font-medium text-text">
              Export safety backup first <span className="font-normal text-faint">(recommended)</span>
            </span>
          </label>

          <div className="space-y-1.5">
            <label htmlFor="reset-confirm" className="text-[12px] text-faint">
              Type <strong className="text-text">RESET</strong> to confirm
            </label>
            <input
              id="reset-confirm"
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="RESET"
              className={inputCls}
            />
          </div>

          {resetError && <StatusNote tone="error">{resetError}</StatusNote>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowResetModal(false);
                setResetConfirmText("");
                setResetError(null);
              }}
              className="rounded-[10px] px-3.5 py-2 text-[13px] text-faint transition-colors hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteReset}
              disabled={resetting || resetConfirmText.trim().toUpperCase() !== "RESET"}
              className="rounded-[10px] bg-danger px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-40"
            >
              {resetting ? "Resetting…" : "Permanently erase"}
            </button>
          </div>
        </div>
      </Modal>
    </SettingsSection>
  );
}
