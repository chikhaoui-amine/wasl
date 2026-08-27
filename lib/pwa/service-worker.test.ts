// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initServiceWorker,
  getPwaState,
  applyServiceWorkerUpdate,
  subscribePwaState,
  resetPwaStateForTesting,
} from "./service-worker";
import {
  registerPendingSaveHandler,
  resetPendingSavesForTesting,
} from "@/lib/data/domains/notes";
import { getLocalDatabase } from "@/lib/data/adapters/local/database";
import manifest from "@/app/manifest";

describe("PWA Service Worker & Offline Infrastructure", () => {
  let mockServiceWorker: any;
  let mockCaches: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetPendingSavesForTesting();

    mockServiceWorker = {
      register: vi.fn().mockResolvedValue({
        scope: "/",
        waiting: null,
        installing: null,
        addEventListener: vi.fn(),
      }),
      getRegistrations: vi.fn().mockResolvedValue([]),
      addEventListener: vi.fn(),
      controller: null,
    };

    mockCaches = {
      keys: vi.fn().mockResolvedValue(["wasl-shell-v0", "other-cache"]),
      delete: vi.fn().mockResolvedValue(true),
    };

    Object.defineProperty(window.navigator, "serviceWorker", {
      value: mockServiceWorker,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window.navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, "caches", {
      value: mockCaches,
      writable: true,
      configurable: true,
    });

    resetPwaStateForTesting();
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetPendingSavesForTesting();
  });

  it("registers /sw.js in Local Edition", async () => {
    await initServiceWorker();

    expect(mockServiceWorker.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("detects when a waiting worker is available and notifies subscribers", async () => {
    const mockWaitingWorker = { postMessage: vi.fn() };
    mockServiceWorker.register.mockResolvedValue({
      scope: "/",
      waiting: mockWaitingWorker,
      installing: null,
      addEventListener: vi.fn(),
    });

    let lastState: any = null;
    const unsubscribe = subscribePwaState((state) => {
      lastState = state;
    });

    await initServiceWorker();

    expect(lastState?.updateAvailable).toBe(true);
    expect(lastState?.waitingWorker).toBe(mockWaitingWorker);

    unsubscribe();
  });

  it("sends SKIP_WAITING message when applying update with clean state", async () => {
    const mockWaitingWorker = { postMessage: vi.fn() };
    mockServiceWorker.register.mockResolvedValue({
      scope: "/",
      waiting: mockWaitingWorker,
      installing: null,
      addEventListener: vi.fn(),
    });

    await initServiceWorker();
    expect(getPwaState().updateAvailable).toBe(true);

    const success = await applyServiceWorkerUpdate();
    expect(success).toBe(true);
    expect(mockWaitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("flushes unsaved Notes draft successfully before applying service worker update", async () => {
    const mockWaitingWorker = { postMessage: vi.fn() };
    mockServiceWorker.register.mockResolvedValue({
      scope: "/",
      waiting: mockWaitingWorker,
      installing: null,
      addEventListener: vi.fn(),
    });

    await initServiceWorker();

    let dirty = true;
    const mockFlush = vi.fn().mockImplementation(async () => {
      dirty = false; // flush succeeds and clears dirty state
      return true;
    });

    registerPendingSaveHandler({
      isDirty: () => dirty,
      flush: mockFlush,
    });

    const success = await applyServiceWorkerUpdate();
    expect(mockFlush).toHaveBeenCalledTimes(1);
    expect(success).toBe(true);
    expect(mockWaitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("cancels update and preserves draft if pending note save fails or remains dirty", async () => {
    const mockWaitingWorker = { postMessage: vi.fn() };
    mockServiceWorker.register.mockResolvedValue({
      scope: "/",
      waiting: mockWaitingWorker,
      installing: null,
      addEventListener: vi.fn(),
    });

    await initServiceWorker();

    // Register a dirty/failing note form save handler
    registerPendingSaveHandler({
      isDirty: () => true,
      flush: async () => false, // save failed
    });

    const success = await applyServiceWorkerUpdate();
    expect(success).toBe(false);
    expect(mockWaitingWorker.postMessage).not.toHaveBeenCalled();
  });

  it("preserves IndexedDB data when service worker caches are created or cleared", async () => {
    const db = getLocalDatabase();
    await db.documents.put({
      store: "lifeos-notes",
      version: 3,
      state: { notes: [], categories: [] },
      updatedAt: "2026-08-23T00:00:00.000Z",
      revision: 1,
    });

    // Simulate Cloud edition cleanup or SW update
    await initServiceWorker();

    const record = await db.documents.get("lifeos-notes");
    expect(record).toBeDefined();
    expect(record?.store).toBe("lifeos-notes");
  });

  it("tracks online and offline network status transitions", async () => {
    await initServiceWorker();
    let state = getPwaState();
    expect(state.isOffline).toBe(false);

    // Simulate going offline
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    window.dispatchEvent(new Event("offline"));

    state = getPwaState();
    expect(state.isOffline).toBe(true);

    // Simulate going back online
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
    window.dispatchEvent(new Event("online"));

    state = getPwaState();
    expect(state.isOffline).toBe(false);
  });

  it("serves standalone PWA manifest in local edition with icons", () => {
    const localManifest = manifest();
    expect(localManifest.display).toBe("standalone");
    expect(localManifest.icons).toBeDefined();
    expect(localManifest.icons?.length).toBeGreaterThan(0);
  });
});
