import { describe, it, expect } from "vitest";
import { queryKeys } from "./query/keys";
import { createMemoryQueryClient } from "./query/provider";

describe("Query Keys Factory", () => {
  it("generates correct local store query key", () => {
    const key = queryKeys.store("local", null, "lifeos-notes");
    expect(key).toEqual(["wasl-store", "local", "local", "lifeos-notes"]);
  });

  it("generates correct stores collection key", () => {
    const localKey = queryKeys.stores("local");
    expect(localKey).toEqual(["wasl-store", "local", "local"]);
  });

  it("generates meta and preferences query keys", () => {
    expect(queryKeys.meta("local")).toEqual(["wasl-meta", "local"]);
    expect(queryKeys.preferences("local")).toEqual(["wasl-preferences", "local"]);
  });
});

describe("Official QueryClient Integration (Memory Only)", () => {
  it("creates a memory-only TanStack QueryClient with memory defaults", () => {
    const client = createMemoryQueryClient();
    const defaults = client.getDefaultOptions();

    expect(defaults.queries?.staleTime).toBe(1000 * 60 * 5);
    expect(defaults.queries?.gcTime).toBe(1000 * 60 * 30);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it("caches and retrieves data in memory", () => {
    const client = createMemoryQueryClient();
    const key = queryKeys.store("local", null, "lifeos-notes");

    client.setQueryData(key, { notes: [], categories: [] });
    const cached = client.getQueryData(key);

    expect(cached).toEqual({ notes: [], categories: [] });
  });

  it("clears cached queries on reset", () => {
    const client = createMemoryQueryClient();
    const key = queryKeys.store("local", null, "lifeos-notes");

    client.setQueryData(key, { notes: [] });
    expect(client.getQueryData(key)).toBeDefined();

    client.clear();
    expect(client.getQueryData(key)).toBeUndefined();
  });
});
