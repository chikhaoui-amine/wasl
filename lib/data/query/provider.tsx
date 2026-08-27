"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  QueryClient,
  QueryClientProvider as OfficialQueryClientProvider,
  useQueryClient,
  useQuery,
  useMutation,
} from "@tanstack/react-query";
import type { DataAdapter } from "../types";
import { getEdition, type WaslEdition } from "../edition";
import { LocalAdapter } from "../adapters/local/local-adapter";
import { DOMAIN_MIGRATIONS } from "../migrations";
import { queryKeys } from "./keys";

// Re-export standard TanStack Query hooks and classes
export {
  QueryClient,
  useQueryClient,
  useQuery,
  useMutation,
};

/**
 * Creates a standard memory-only QueryClient instance.
 * Strict rule: NEVER configured with localStorage persistence.
 */
export function createMemoryQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes in memory
        gcTime: 1000 * 60 * 30, // 30 minutes in memory
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

// Global memory-only client for client-side usage
let sharedQueryClient: QueryClient | null = null;

export function getSharedQueryClient(): QueryClient {
  if (!sharedQueryClient) {
    sharedQueryClient = createMemoryQueryClient();
  }
  return sharedQueryClient;
}

// Singleton local adapter for browser runtime
let sharedLocalAdapter: LocalAdapter | null = null;
function getSharedLocalAdapter(): LocalAdapter {
  if (!sharedLocalAdapter) {
    sharedLocalAdapter = new LocalAdapter({ migrations: DOMAIN_MIGRATIONS });
  }
  return sharedLocalAdapter;
}

// ==========================================
// 1. Data Context & Provider
// ==========================================

interface DataContextValue {
  adapter: DataAdapter | null;
  edition: WaslEdition;
  userId: string | null;
  isReady: boolean;
  error: Error | null;
}

const DataContext = createContext<DataContextValue | null>(null);

export interface DataProviderProps {
  adapter?: DataAdapter | null;
  userId?: string | null;
  edition?: WaslEdition;
  queryClient?: QueryClient;
  children?: React.ReactNode;
}

/**
 * Data provider providing DataAdapter context and official memory-only QueryClientProvider to client components.
 */
export function DataProvider({
  adapter: propAdapter = null,
  userId = null,
  edition = getEdition(),
  queryClient,
  children,
}: DataProviderProps) {
  const [client] = useState(() => queryClient ?? getSharedQueryClient());
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const adapter = useMemo<DataAdapter | null>(() => {
    if (propAdapter) {
      return propAdapter;
    }
    return getSharedLocalAdapter();
  }, [propAdapter]);

  // Initialize active adapter
  useEffect(() => {
    if (!adapter) {
      return;
    }

    let isMounted = true;

    adapter
      .initialize()
      .then(async () => {
        if (isMounted) {
          setIsReady(true);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsReady(false);
        }
      });

    // Subscribe to adapter store mutations for live query invalidation
    const unsubscribe = adapter.subscribe((storeKey) => {
      if (storeKey) {
        client.invalidateQueries({ queryKey: queryKeys.store(edition, userId, storeKey) });
      } else {
        client.invalidateQueries({ queryKey: queryKeys.stores(edition, userId) });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [adapter, client, edition, userId]);

  return (
    <OfficialQueryClientProvider client={client}>
      <DataContext.Provider value={{ adapter, edition, userId, isReady, error }}>
        {children}
      </DataContext.Provider>
    </OfficialQueryClientProvider>
  );
}

/**
 * Hook to access the active DataAdapter.
 */
export function useDataAdapter(): DataAdapter | null {
  const context = useContext(DataContext);
  return context?.adapter ?? null;
}

/**
 * Hook to access the active WASL edition.
 */
export function useDataEdition(): WaslEdition {
  const context = useContext(DataContext);
  return context?.edition ?? getEdition();
}

/**
 * Hook to access the active user ID (always null in Local Edition).
 */
export function useDataUserId(): string | null {
  const context = useContext(DataContext);
  return context?.userId ?? null;
}

/**
 * Hook to check if the active DataAdapter is initialized and ready.
 */
export function useDataReady(): boolean {
  const context = useContext(DataContext);
  return context?.isReady ?? false;
}
