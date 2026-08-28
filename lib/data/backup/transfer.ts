import type {
  DataAdapter,
  WaslTransfer,
  WaslTransferSelection,
  DuplicateResolutionStrategy,
  TransferPreviewDetails,
  TransferStoreDetail,
  StoreDocument,
  StoreStateMap,
} from "../types";
import { isStoreKey, type StoreKey } from "../store-registry";
import { validateWaslTransfer } from "../schemas";
import { calculateBackupChecksum, canonicalizeJson, computeSha256Hex } from "./canonical";
import { MAX_BACKUP_SIZE_BYTES } from "./preview";

export interface ExportTransferOptions {
  appVersion?: string;
  preferences?: Record<string, unknown>;
}

export interface ExportTransferResult {
  transfer: WaslTransfer;
  json: string;
}

export interface ImportTransferResult {
  success: boolean;
  storesUpdated: number;
  entitiesImported: number;
  entitiesSkipped: number;
  entitiesReplaced: number;
  entitiesCopied: number;
}

type EntityRecord = { id?: string; name?: string; title?: string; [key: string]: unknown };

/**
 * Extracts entity IDs and items from a domain store state.
 */
export function extractStoreEntities(store: StoreKey, state: unknown): EntityRecord[] {
  if (!state || typeof state !== "object") return [];
  const s = state as Record<string, unknown>;

  switch (store) {
    case "lifeos-notes":
      return Array.isArray(s.notes) ? (s.notes as EntityRecord[]) : [];
    case "lifeos-goals":
      return Array.isArray(s.goals) ? (s.goals as EntityRecord[]) : [];
    case "lifeos-tasks":
      return Array.isArray(s.tasks) ? (s.tasks as EntityRecord[]) : [];
    case "lifeos-habits":
      return Array.isArray(s.habits) ? (s.habits as EntityRecord[]) : [];
    case "lifeos-blocks":
      return Array.isArray(s.blocks) ? (s.blocks as EntityRecord[]) : [];
    case "lifeos-journal":
      return Array.isArray(s.entries) ? (s.entries as EntityRecord[]) : [];
    case "lifeos-money": {
      const accounts = Array.isArray(s.accounts) ? (s.accounts as EntityRecord[]) : [];
      const txns = Array.isArray(s.transactions) ? (s.transactions as EntityRecord[]) : [];
      const savings = Array.isArray(s.savings) ? (s.savings as EntityRecord[]) : [];
      return [...accounts, ...txns, ...savings];
    }
    case "lifeos-health": {
      const workouts = Array.isArray(s.workouts) ? (s.workouts as EntityRecord[]) : [];
      const programs = Array.isArray(s.programs) ? (s.programs as EntityRecord[]) : [];
      const exercises = Array.isArray(s.exercises) ? (s.exercises as EntityRecord[]) : [];
      return [...workouts, ...programs, ...exercises];
    }
    case "lifeos-topics":
      return Array.isArray(s.topics) ? (s.topics as EntityRecord[]) : [];
    case "lifeos-recurring":
      return Array.isArray(s.recurring) ? (s.recurring as EntityRecord[]) : [];
    case "lifeos-trash":
      return Array.isArray(s.items) ? (s.items as EntityRecord[]) : [];
    default:
      return [];
  }
}

/**
 * Filters a store state to retain only selected entity IDs.
 */
function filterStoreStateByEntityIds(
  store: StoreKey,
  state: Record<string, unknown>,
  selectedIds: Set<string>,
): Record<string, unknown> {
  const filtered = { ...state };

  switch (store) {
    case "lifeos-notes":
      if (Array.isArray(state.notes)) {
        filtered.notes = state.notes.filter((n: EntityRecord) => n.id && selectedIds.has(n.id));
      }
      break;
    case "lifeos-goals":
      if (Array.isArray(state.goals)) {
        filtered.goals = state.goals.filter((g: EntityRecord) => g.id && selectedIds.has(g.id));
      }
      break;
    case "lifeos-tasks":
      if (Array.isArray(state.tasks)) {
        filtered.tasks = state.tasks.filter((t: EntityRecord) => t.id && selectedIds.has(t.id));
      }
      break;
    case "lifeos-habits":
      if (Array.isArray(state.habits)) {
        filtered.habits = state.habits.filter((h: EntityRecord) => h.id && selectedIds.has(h.id));
      }
      break;
    case "lifeos-blocks":
      if (Array.isArray(state.blocks)) {
        filtered.blocks = state.blocks.filter((b: EntityRecord) => b.id && selectedIds.has(b.id));
      }
      break;
    case "lifeos-journal":
      if (Array.isArray(state.entries)) {
        filtered.entries = state.entries.filter((e: EntityRecord) => e.id && selectedIds.has(e.id));
      }
      break;
    case "lifeos-money":
      if (Array.isArray(state.accounts)) {
        filtered.accounts = state.accounts.filter(
          (a: EntityRecord) => a.id && selectedIds.has(a.id),
        );
      }
      if (Array.isArray(state.transactions)) {
        filtered.transactions = state.transactions.filter(
          (t: EntityRecord) => t.id && selectedIds.has(t.id),
        );
      }
      if (Array.isArray(state.savings)) {
        filtered.savings = state.savings.filter((s: EntityRecord) => s.id && selectedIds.has(s.id));
      }
      break;
    case "lifeos-health":
      if (Array.isArray(state.workouts)) {
        filtered.workouts = state.workouts.filter((w: EntityRecord) => w.id && selectedIds.has(w.id));
      }
      if (Array.isArray(state.programs)) {
        filtered.programs = state.programs.filter((p: EntityRecord) => p.id && selectedIds.has(p.id));
      }
      if (Array.isArray(state.exercises)) {
        filtered.exercises = state.exercises.filter((e: EntityRecord) => e.id && selectedIds.has(e.id));
      }
      break;
    case "lifeos-topics":
      if (Array.isArray(state.topics)) {
        filtered.topics = state.topics.filter((t: EntityRecord) => t.id && selectedIds.has(t.id));
      }
      break;
    case "lifeos-recurring":
      if (Array.isArray(state.recurring)) {
        filtered.recurring = state.recurring.filter(
          (r: EntityRecord) => r.id && selectedIds.has(r.id),
        );
      }
      break;
    case "lifeos-trash":
      if (Array.isArray(state.items)) {
        filtered.items = state.items.filter((i: EntityRecord) => i.id && selectedIds.has(i.id));
      }
      break;
  }

  return filtered;
}

/**
 * Exports a selective transfer package (.wasl-transfer) containing only specified domains or entities.
 */
export async function exportWaslTransfer(
  adapter: DataAdapter,
  selection: WaslTransferSelection,
  options?: ExportTransferOptions,
): Promise<ExportTransferResult> {
  const allDocs = await adapter.getAllStores();
  const selectedDomainSet = new Set(selection.domains ?? []);
  const selectedEntitiesMap = selection.entities ?? {};

  const exportedStores: StoreDocument<StoreKey>[] = [];

  for (const doc of allDocs) {
    const isDomainSelected = selectedDomainSet.has(doc.store);
    const entityIds = selectedEntitiesMap[doc.store];
    const hasSelectedEntities = Array.isArray(entityIds) && entityIds.length > 0;

    if (!isDomainSelected && !hasSelectedEntities) {
      continue;
    }

    if (typeof doc.version !== "number" || isNaN(doc.version) || doc.version < 0) {
      throw new Error(`Transfer failed: Store "${doc.store}" has invalid version.`);
    }

    let exportedState = doc.state as unknown as Record<string, unknown>;

    if (!isDomainSelected && hasSelectedEntities) {
      exportedState = filterStoreStateByEntityIds(
        doc.store,
        exportedState,
        new Set(entityIds),
      ) as unknown as Record<string, unknown>;
    }

    // Verify JSON serializability
    try {
      JSON.stringify(exportedState);
    } catch (err) {
      throw new Error(
        `Transfer failed: Store "${doc.store}" state is not JSON-serializable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    exportedStores.push({
      store: doc.store,
      version: doc.version,
      state: exportedState as unknown as (typeof doc)["state"],
      updatedAt: doc.updatedAt,
      revision: doc.revision,
    });
  }

  exportedStores.sort((a, b) => a.store.localeCompare(b.store));

  const payloadWithoutChecksum: Omit<WaslTransfer, "checksum"> = {
    format: "wasl-selective-transfer",
    formatVersion: 1,
    appVersion: options?.appVersion ?? "0.1.0",
    exportedAt: new Date().toISOString(),
    sourceEdition: adapter.edition,
    selection,
    stores: exportedStores,
    preferences: options?.preferences,
  };

  const checksum = await calculateBackupChecksum(
    payloadWithoutChecksum as unknown as Omit<import("../types").WaslBackup, "checksum">,
  );

  const transfer: WaslTransfer = {
    ...payloadWithoutChecksum,
    checksum,
  };

  const json = JSON.stringify(transfer, null, 2);
  return { transfer, json };
}

/**
 * Previews a .wasl-transfer file, verifying its checksum, duplicate entity count, and cross-domain dependencies.
 */
export async function previewWaslTransfer(
  rawInput: string | unknown,
  targetAdapter?: DataAdapter,
): Promise<TransferPreviewDetails> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const dependencyWarnings: string[] = [];

  let parsed: unknown;
  if (typeof rawInput === "string") {
    const byteSize = new TextEncoder().encode(rawInput).length;
    if (byteSize > MAX_BACKUP_SIZE_BYTES) {
      return {
        valid: false,
        appVersion: "unknown",
        exportedAt: "unknown",
        sourceEdition: "local",
        storeCount: 0,
        totalEntitiesCount: 0,
        stores: [],
        dependencyWarnings: [],
        warnings: [],
        errors: [`File size exceeds maximum limit of 50 MiB.`],
      };
    }

    try {
      parsed = JSON.parse(rawInput);
    } catch (err) {
      return {
        valid: false,
        appVersion: "unknown",
        exportedAt: "unknown",
        sourceEdition: "local",
        storeCount: 0,
        totalEntitiesCount: 0,
        stores: [],
        dependencyWarnings: [],
        warnings: [],
        errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  } else {
    parsed = rawInput;
  }

  const envelope = validateWaslTransfer(parsed);
  if (!envelope.success || !envelope.data) {
    return {
      valid: false,
      appVersion: (parsed as Partial<WaslTransfer>)?.appVersion ?? "unknown",
      exportedAt: (parsed as Partial<WaslTransfer>)?.exportedAt ?? "unknown",
      sourceEdition: (parsed as Partial<WaslTransfer>)?.sourceEdition ?? "local",
      storeCount: 0,
      totalEntitiesCount: 0,
      stores: [],
      dependencyWarnings: [],
      warnings: [],
      errors: [`Transfer envelope validation failed: ${envelope.error}`],
    };
  }

  const transfer = envelope.data;

  // Verify SHA-256 checksum
  const { checksum: expectedChecksum, ...payload } = transfer;
  const canonicalString = canonicalizeJson(payload);
  const computedChecksum = await computeSha256Hex(canonicalString);
  if (computedChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
    errors.push("Checksum mismatch: transfer file contents have been modified or corrupted.");
  }

  // Analyze target stores and duplicate IDs if adapter provided
  const storeDetails: TransferStoreDetail[] = [];
  let totalEntitiesCount = 0;

  const targetStoreMap: Partial<Record<StoreKey, StoreDocument<StoreKey>>> = {};
  if (targetAdapter) {
    const existing = await targetAdapter.getAllStores();
    for (const doc of existing) {
      targetStoreMap[doc.store] = doc;
    }
  }

  // Transfer store lookup
  const transferStoreMap: Partial<Record<StoreKey, StoreDocument<StoreKey>>> = {};
  for (const doc of transfer.stores) {
    transferStoreMap[doc.store] = doc;
  }

  for (const doc of transfer.stores) {
    if (!isStoreKey(doc.store)) {
      errors.push(`Unrecognized store "${doc.store}" in transfer.`);
      continue;
    }

    const transferEntities = extractStoreEntities(doc.store, doc.state);
    totalEntitiesCount += transferEntities.length;

    const targetDoc = targetStoreMap[doc.store];
    const targetEntities = targetDoc ? extractStoreEntities(doc.store, targetDoc.state) : [];
    const targetIdSet = new Set(targetEntities.map((e) => e.id).filter(Boolean));

    const duplicateEntityIds: string[] = [];
    for (const entity of transferEntities) {
      if (entity.id && targetIdSet.has(entity.id)) {
        duplicateEntityIds.push(entity.id);
      }
    }

    storeDetails.push({
      store: doc.store,
      version: doc.version,
      totalEntities: transferEntities.length,
      duplicateCount: duplicateEntityIds.length,
      newCount: transferEntities.length - duplicateEntityIds.length,
      duplicateEntityIds,
    });
  }

  // Cross-Domain Reference / Dependency Analysis
  // 1. Task -> Goal references
  const transferTasksDoc = transferStoreMap["lifeos-tasks"];
  if (transferTasksDoc && Array.isArray((transferTasksDoc.state as unknown as { tasks?: unknown[] }).tasks)) {
    const targetGoalsDoc = targetStoreMap["lifeos-goals"];
    const transferGoalsDoc = transferStoreMap["lifeos-goals"];
    const knownGoalIds = new Set<string>();

    if (targetGoalsDoc && Array.isArray((targetGoalsDoc.state as unknown as { goals?: EntityRecord[] }).goals)) {
      for (const g of (targetGoalsDoc.state as unknown as { goals: EntityRecord[] }).goals) {
        if (g.id) knownGoalIds.add(g.id);
      }
    }
    if (transferGoalsDoc && Array.isArray((transferGoalsDoc.state as unknown as { goals?: EntityRecord[] }).goals)) {
      for (const g of (transferGoalsDoc.state as unknown as { goals: EntityRecord[] }).goals) {
        if (g.id) knownGoalIds.add(g.id);
      }
    }

    for (const task of (transferTasksDoc.state as unknown as { tasks: EntityRecord[] }).tasks) {
      if (task.goalId && typeof task.goalId === "string" && !knownGoalIds.has(task.goalId)) {
        dependencyWarnings.push(
          `Task "${task.title || task.id}" references Goal ID "${task.goalId}" which is not found in the transfer or destination.`,
        );
      }
    }
  }

  // 2. Health: Workout -> Program references
  const transferHealthDoc = transferStoreMap["lifeos-health"];
  if (transferHealthDoc) {
    const targetHealthDoc = targetStoreMap["lifeos-health"];
    const knownProgramIds = new Set<string>();

    if (targetHealthDoc && Array.isArray((targetHealthDoc.state as unknown as { programs?: EntityRecord[] }).programs)) {
      for (const p of (targetHealthDoc.state as unknown as { programs: EntityRecord[] }).programs) {
        if (p.id) knownProgramIds.add(p.id);
      }
    }
    if (Array.isArray((transferHealthDoc.state as unknown as { programs?: EntityRecord[] }).programs)) {
      for (const p of (transferHealthDoc.state as unknown as { programs: EntityRecord[] }).programs) {
        if (p.id) knownProgramIds.add(p.id);
      }
    }

    if (Array.isArray((transferHealthDoc.state as unknown as { workouts?: EntityRecord[] }).workouts)) {
      for (const w of (transferHealthDoc.state as unknown as { workouts: EntityRecord[] }).workouts) {
        if (w.programId && typeof w.programId === "string" && !knownProgramIds.has(w.programId)) {
          dependencyWarnings.push(
            `Workout "${w.title || w.id}" references Program ID "${w.programId}" which is not found in the transfer or destination.`,
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    appVersion: transfer.appVersion,
    exportedAt: transfer.exportedAt,
    sourceEdition: transfer.sourceEdition,
    storeCount: transfer.stores.length,
    totalEntitiesCount,
    stores: storeDetails,
    dependencyWarnings,
    warnings,
    errors,
    transfer: errors.length === 0 ? transfer : undefined,
  };
}

/**
 * Merges an array of incoming entities into an existing array using the selected conflict strategy.
 */
function mergeEntityArrays(
  existing: EntityRecord[],
  incoming: EntityRecord[],
  strategy: DuplicateResolutionStrategy,
): { merged: EntityRecord[]; imported: number; skipped: number; replaced: number; copied: number } {
  let imported = 0;
  let skipped = 0;
  let replaced = 0;
  let copied = 0;

  const existingMap = new Map<string, EntityRecord>();
  const order: string[] = [];

  for (const item of existing) {
    if (item.id) {
      existingMap.set(item.id, item);
      order.push(item.id);
    }
  }

  for (const item of incoming) {
    if (!item.id) {
      existing.push(item);
      imported++;
      continue;
    }

    if (existingMap.has(item.id)) {
      if (strategy === "skip") {
        skipped++;
      } else if (strategy === "replace") {
        existingMap.set(item.id, item);
        replaced++;
      } else if (strategy === "copy") {
        const newId = `${item.id}-copy-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        const copyTitle = item.title ? `${item.title} (Copy)` : item.name ? `${item.name} (Copy)` : undefined;
        const copyItem = { ...item, id: newId, ...(copyTitle ? { title: item.title ? copyTitle : undefined, name: item.name ? copyTitle : undefined } : {}) };
        existingMap.set(newId, copyItem);
        order.push(newId);
        copied++;
      }
    } else {
      existingMap.set(item.id, item);
      order.push(item.id);
      imported++;
    }
  }

  const merged = order.map((id) => existingMap.get(id)!).filter(Boolean);
  return { merged, imported, skipped, replaced, copied };
}

/**
 * Union-merges two day-keyed maps (e.g. health `days`, tasks `dailyFocus`).
 *
 * A plain spread (`{...current, ...incoming}`) replaces each shared day's value
 * wholesale, silently clobbering fields recorded on this device that the
 * incoming partial transfer never contained. This merge unions the object
 * fields per day instead: incoming values win for keys it explicitly carries,
 * but current-device-only fields survive.
 */
function mergeDayKeyedMaps(cur: unknown, inc: unknown): Record<string, unknown> {
  const result: Record<string, unknown> =
    cur && typeof cur === "object" && !Array.isArray(cur) ? { ...(cur as Record<string, unknown>) } : {};

  if (!inc || typeof inc !== "object" || Array.isArray(inc)) {
    return result;
  }

  for (const [day, incomingVal] of Object.entries(inc as Record<string, unknown>)) {
    const currentVal = result[day];
    const bothPlainObjects =
      currentVal &&
      incomingVal &&
      typeof currentVal === "object" &&
      !Array.isArray(currentVal) &&
      typeof incomingVal === "object" &&
      !Array.isArray(incomingVal);

    result[day] = bothPlainObjects
      ? { ...(currentVal as object), ...(incomingVal as object) }
      : incomingVal;
  }

  return result;
}

/**
 * Merges a selective transfer into the target DataAdapter using the specified conflict resolution strategy.
 */
export async function importWaslTransfer(
  adapter: DataAdapter,
  transferInput: WaslTransfer | string,
  options?: { strategy?: DuplicateResolutionStrategy },
): Promise<ImportTransferResult> {
  const strategy = options?.strategy ?? "skip";
  const preview = await previewWaslTransfer(transferInput, adapter);

  if (!preview.valid || !preview.transfer) {
    throw new Error(`Transfer validation failed:\n${preview.errors.join("\n")}`);
  }

  const transfer = preview.transfer;
  let totalImported = 0;
  let totalSkipped = 0;
  let totalReplaced = 0;
  let totalCopied = 0;
  let storesUpdated = 0;

  for (const transferDoc of transfer.stores) {
    const storeKey = transferDoc.store;
    if (!isStoreKey(storeKey)) continue;

    let storeImported = 0;
    let storeSkipped = 0;
    let storeReplaced = 0;
    let storeCopied = 0;

    await adapter.mutateStore(storeKey, (currentState) => {
      const current = (currentState && typeof currentState === "object" ? currentState : {}) as unknown as Record<string, unknown>;
      const incoming = transferDoc.state as unknown as Record<string, unknown>;
      const nextState = { ...current };

      switch (storeKey) {
        case "lifeos-notes": {
          const notesRes = mergeEntityArrays(
            Array.isArray(current.notes) ? (current.notes as EntityRecord[]) : [],
            Array.isArray(incoming.notes) ? (incoming.notes as EntityRecord[]) : [],
            strategy,
          );
          nextState.notes = notesRes.merged;
          storeImported = notesRes.imported;
          storeSkipped = notesRes.skipped;
          storeReplaced = notesRes.replaced;
          storeCopied = notesRes.copied;

          // Merge categories if present
          if (Array.isArray(incoming.categories)) {
            const catRes = mergeEntityArrays(
              Array.isArray(current.categories) ? (current.categories as EntityRecord[]) : [],
              incoming.categories as EntityRecord[],
              "skip",
            );
            nextState.categories = catRes.merged;
          }
          break;
        }
        case "lifeos-goals": {
          const res = mergeEntityArrays(
            Array.isArray(current.goals) ? (current.goals as EntityRecord[]) : [],
            Array.isArray(incoming.goals) ? (incoming.goals as EntityRecord[]) : [],
            strategy,
          );
          nextState.goals = res.merged;
          storeImported = res.imported;
          storeSkipped = res.skipped;
          storeReplaced = res.replaced;
          storeCopied = res.copied;
          break;
        }
        case "lifeos-tasks": {
          const res = mergeEntityArrays(
            Array.isArray(current.tasks) ? (current.tasks as EntityRecord[]) : [],
            Array.isArray(incoming.tasks) ? (incoming.tasks as EntityRecord[]) : [],
            strategy,
          );
          nextState.tasks = res.merged;
          nextState.dailyFocus = mergeDayKeyedMaps(current.dailyFocus, incoming.dailyFocus) as never;
          storeImported = res.imported;
          storeSkipped = res.skipped;
          storeReplaced = res.replaced;
          storeCopied = res.copied;
          break;
        }
        case "lifeos-habits": {
          const res = mergeEntityArrays(
            Array.isArray(current.habits) ? (current.habits as EntityRecord[]) : [],
            Array.isArray(incoming.habits) ? (incoming.habits as EntityRecord[]) : [],
            strategy,
          );
          nextState.habits = res.merged;
          storeImported = res.imported;
          storeSkipped = res.skipped;
          storeReplaced = res.replaced;
          storeCopied = res.copied;
          break;
        }
        case "lifeos-blocks": {
          const res = mergeEntityArrays(
            Array.isArray(current.blocks) ? (current.blocks as EntityRecord[]) : [],
            Array.isArray(incoming.blocks) ? (incoming.blocks as EntityRecord[]) : [],
            strategy,
          );
          nextState.blocks = res.merged;
          storeImported = res.imported;
          storeSkipped = res.skipped;
          storeReplaced = res.replaced;
          storeCopied = res.copied;
          break;
        }
        case "lifeos-journal": {
          const res = mergeEntityArrays(
            Array.isArray(current.entries) ? (current.entries as EntityRecord[]) : [],
            Array.isArray(incoming.entries) ? (incoming.entries as EntityRecord[]) : [],
            strategy,
          );
          nextState.entries = res.merged;
          storeImported = res.imported;
          storeSkipped = res.skipped;
          storeReplaced = res.replaced;
          storeCopied = res.copied;
          break;
        }
        case "lifeos-money": {
          const accRes = mergeEntityArrays(
            Array.isArray(current.accounts) ? (current.accounts as EntityRecord[]) : [],
            Array.isArray(incoming.accounts) ? (incoming.accounts as EntityRecord[]) : [],
            strategy,
          );
          const txnRes = mergeEntityArrays(
            Array.isArray(current.transactions) ? (current.transactions as EntityRecord[]) : [],
            Array.isArray(incoming.transactions) ? (incoming.transactions as EntityRecord[]) : [],
            strategy,
          );
          const savRes = mergeEntityArrays(
            Array.isArray(current.savings) ? (current.savings as EntityRecord[]) : [],
            Array.isArray(incoming.savings) ? (incoming.savings as EntityRecord[]) : [],
            strategy,
          );
          nextState.accounts = accRes.merged;
          nextState.transactions = txnRes.merged;
          nextState.savings = savRes.merged;
          nextState.currency = incoming.currency || current.currency || "USD";
          storeImported = accRes.imported + txnRes.imported + savRes.imported;
          storeSkipped = accRes.skipped + txnRes.skipped + savRes.skipped;
          storeReplaced = accRes.replaced + txnRes.replaced + savRes.replaced;
          storeCopied = accRes.copied + txnRes.copied + savRes.copied;
          break;
        }
        case "lifeos-health": {
          const wRes = mergeEntityArrays(
            Array.isArray(current.workouts) ? (current.workouts as EntityRecord[]) : [],
            Array.isArray(incoming.workouts) ? (incoming.workouts as EntityRecord[]) : [],
            strategy,
          );
          const pRes = mergeEntityArrays(
            Array.isArray(current.programs) ? (current.programs as EntityRecord[]) : [],
            Array.isArray(incoming.programs) ? (incoming.programs as EntityRecord[]) : [],
            strategy,
          );
          const eRes = mergeEntityArrays(
            Array.isArray(current.exercises) ? (current.exercises as EntityRecord[]) : [],
            Array.isArray(incoming.exercises) ? (incoming.exercises as EntityRecord[]) : [],
            strategy,
          );
          nextState.workouts = wRes.merged;
          nextState.programs = pRes.merged;
          nextState.exercises = eRes.merged;
          nextState.days = mergeDayKeyedMaps(current.days, incoming.days) as never;
          storeImported = wRes.imported + pRes.imported + eRes.imported;
          storeSkipped = wRes.skipped + pRes.skipped + eRes.skipped;
          storeReplaced = wRes.replaced + pRes.replaced + eRes.replaced;
          storeCopied = wRes.copied + pRes.copied + eRes.copied;
          break;
        }
        case "lifeos-topics": {
          const res = mergeEntityArrays(
            Array.isArray(current.topics) ? (current.topics as EntityRecord[]) : [],
            Array.isArray(incoming.topics) ? (incoming.topics as EntityRecord[]) : [],
            strategy,
          );
          nextState.topics = res.merged;
          storeImported = res.imported;
          storeSkipped = res.skipped;
          storeReplaced = res.replaced;
          storeCopied = res.copied;
          break;
        }
        case "lifeos-recurring": {
          const res = mergeEntityArrays(
            Array.isArray(current.recurring) ? (current.recurring as EntityRecord[]) : [],
            Array.isArray(incoming.recurring) ? (incoming.recurring as EntityRecord[]) : [],
            strategy,
          );
          nextState.recurring = res.merged;
          storeImported = res.imported;
          storeSkipped = res.skipped;
          storeReplaced = res.replaced;
          storeCopied = res.copied;
          break;
        }
        case "lifeos-trash": {
          const res = mergeEntityArrays(
            Array.isArray(current.items) ? (current.items as EntityRecord[]) : [],
            Array.isArray(incoming.items) ? (incoming.items as EntityRecord[]) : [],
            strategy,
          );
          nextState.items = res.merged;
          storeImported = res.imported;
          storeSkipped = res.skipped;
          storeReplaced = res.replaced;
          storeCopied = res.copied;
          break;
        }
      }

      return nextState as unknown as StoreStateMap[typeof storeKey];
    });

    totalImported += storeImported;
    totalSkipped += storeSkipped;
    totalReplaced += storeReplaced;
    totalCopied += storeCopied;
    storesUpdated++;
  }

  return {
    success: true,
    storesUpdated,
    entitiesImported: totalImported,
    entitiesSkipped: totalSkipped,
    entitiesReplaced: totalReplaced,
    entitiesCopied: totalCopied,
  };
}
