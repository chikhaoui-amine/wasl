"use client";

export interface GoogleSyncStatus {
  connected: boolean;
  configured: boolean;
  calendarId: string;
  lastSyncedAt: string | null;
  syncStatus: "idle" | "syncing" | "error";
  errorMessage: string | null;
  syncNow: () => Promise<void>;
  connectGoogle: () => void;
  disconnectGoogle: () => Promise<void>;
}

export function useGoogleCalendarSync(): GoogleSyncStatus {
  return {
    connected: false,
    configured: false,
    calendarId: "primary",
    lastSyncedAt: null,
    syncStatus: "idle",
    errorMessage: null,
    syncNow: async () => {},
    connectGoogle: () => {},
    disconnectGoogle: async () => {},
  };
}
