/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Unit tests for the plain-JS service worker (public/sw.js) in its Local
// Edition flavor (no ?edition=cloud in the registration URL). The worker is
// imported fresh for every test so module state (active cache, throttles) is
// fully reset.

const ORIGIN = "http://localhost:3000";

type SWHandler = (event: any) => void;
let handlers: Record<string, SWHandler[]>;
let cacheMap: Map<string, any>;
let fetchImpl: (url: string, init?: any) => Promise<Response>;

function jsonResponse(body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function okResponse(body: string, headers?: Record<string, string>) {
  return new Response(body, { status: 200, headers });
}

function toUrl(url: string): string {
  return url.startsWith("http") ? url : ORIGIN + url;
}

function defaultFetch(url: string, init?: any): Promise<Response> {
  const parsed = new URL(toUrl(url));
  const path = parsed.pathname + parsed.search;
  if (path === "/precache-manifest.json") return Promise.resolve(jsonResponse(manifest));
  if (path.startsWith("/_next/static/")) return Promise.resolve(okResponse(`asset:${path}`));
  if (init?.headers && new Headers(init.headers).get("RSC") === "1") {
    return Promise.resolve(okResponse(`rsc:${path}`, { "Content-Type": "text/x-component" }));
  }
  return Promise.resolve(okResponse(`html:${path}`, { "Content-Type": "text/html" }));
}

const manifest = {
  buildId: "b1",
  generatedAt: "2026-08-26T00:00:00.000Z",
  routes: ["/", "/notes", "/tasks"],
  assets: ["/_next/static/chunks/main-abc.js", "/_next/static/css/app.css"],
};

async function importWorker() {
  vi.resetModules();
  const swPath = "../../public/sw.js";
  await import(swPath);
}

function dispatch(type: string, event: Record<string, unknown>) {
  const list = handlers[type];
  if (!list || list.length === 0) throw new Error(`No service worker listener registered for "${type}"`);
  for (const handler of list) handler(event);
}

async function runInstall(): Promise<void> {
  const waits: Promise<unknown>[] = [];
  dispatch("install", { waitUntil: (p: Promise<unknown>) => waits.push(p) });
  await Promise.all(waits);
}

async function runActivate(): Promise<void> {
  const waits: Promise<unknown>[] = [];
  dispatch("activate", { waitUntil: (p: Promise<unknown>) => waits.push(p) });
  await Promise.all(waits);
}

async function runFetch(request: Request): Promise<Response | undefined> {
  let responded: Promise<Response> | undefined;
  dispatch("fetch", { request, respondWith: (p: Promise<Response>) => (responded = p) });
  return responded;
}

async function runFetchResponse(request: Request): Promise<Response> {
  const response = await runFetch(request);
  if (!response) throw new Error("fetch handler did not call respondWith");
  return response;
}

// The Request constructor cannot create navigation-mode requests (browser
// only), so force the mode the way a real navigation event would carry it.
function navigateRequest(url: string): Request {
  const request = new Request(url);
  Object.defineProperty(request, "mode", { value: "navigate" });
  return request;
}

async function installWithManifest(): Promise<any> {
  await runInstall();
  return cacheMap.get("wasl-shell-build-b1");
}

beforeEach(async () => {
  vi.restoreAllMocks();
  handlers = {};
  cacheMap = new Map();

  vi.stubGlobal("self", globalThis);
  vi.stubGlobal("location", { search: "", origin: ORIGIN });
  vi.stubGlobal("clients", { claim: vi.fn(async () => {}) });
  vi.stubGlobal("addEventListener", vi.fn((type: string, handler: SWHandler) => {
    (handlers[type] ??= []).push(handler);
  }));
  // Map-backed CacheStorage mock (exact-key matching + optional ignoreSearch)
  const cachesApi = {
    open: vi.fn(async (name: string) => {
      let cache = cacheMap.get(name);
      if (!cache) {
        const entries = new Map<string, Response>();
        cache = {
          entries,
          put: vi.fn(async (request: Request | string, response: Response) => {
            entries.set(toUrl(typeof request === "string" ? request : request.url), response);
          }),
          match: vi.fn(async (request: Request | string, options?: { ignoreSearch?: boolean }) => {
            const key = toUrl(typeof request === "string" ? request : request.url);
            const direct = entries.get(key);
            if (direct || !options?.ignoreSearch) return direct ? direct.clone() : undefined;
            const wanted = new URL(key);
            for (const [existingKey, response] of entries) {
              const existing = new URL(existingKey);
              if (existing.origin === wanted.origin && existing.pathname === wanted.pathname) {
                return response.clone();
              }
            }
            return undefined;
          }),
        };
        cacheMap.set(name, cache);
      }
      return cache;
    }),
    keys: vi.fn(async () => [...cacheMap.keys()]),
    delete: vi.fn(async (name: string) => cacheMap.delete(name)),
  };
  vi.stubGlobal("caches", cachesApi);

  fetchImpl = vi.fn(defaultFetch);
  vi.stubGlobal("fetch", vi.fn((input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    // Requests carry their own headers (e.g. RSC) — forward them like the
    // browser would when the worker re-fetches an intercepted request.
    const headers = typeof input === "string" ? init?.headers : input.headers;
    return fetchImpl(url, { headers });
  }));

  manifest.buildId = "b1";
  manifest.routes = ["/", "/notes", "/tasks"];
  manifest.assets = ["/_next/static/chunks/main-abc.js", "/_next/static/css/app.css"];

  await importWorker();
});

describe("service worker install & manifest adoption", () => {
  it("precaches all build assets and warms every route (HTML + RSC) into a build-scoped cache", async () => {
    const cache = await installWithManifest();

    expect(await cache.match("/_next/static/chunks/main-abc.js")).toBeDefined();
    expect(await cache.match("/_next/static/css/app.css")).toBeDefined();
    expect(await (await cache.match("/notes")).text()).toBe("html:/notes");
    expect(await (await cache.match("/__wasl-rsc/notes")).text()).toBe("rsc:/notes");
    expect(await cache.match("/__wasl-rsc/tasks")).toBeDefined();
    expect(await cache.match("/offline")).toBeDefined();

    const meta = await (await cache.match("/__wasl-build-meta")).json();
    expect(meta.buildId).toBe("b1");

    // The fallback shell cache is replaced by the build cache
    expect([...cacheMap.keys()]).toEqual(["wasl-shell-build-b1"]);
  });

  it("falls back to the static shell cache when no manifest is available", async () => {
    fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("precache-manifest")) return new Response("", { status: 404 });
      return defaultFetch(url);
    });

    await runInstall();

    expect([...cacheMap.keys()]).toEqual(["wasl-shell-v3"]);
    const cache = cacheMap.get("wasl-shell-v3");
    expect(await cache.match("/")).toBeDefined();
    expect(await cache.match("/offline")).toBeDefined();
  });

  it("adopts a new build on WASL_PRECACHE_REFRESH and deletes the previous build cache", async () => {
    await runInstall();

    manifest.buildId = "b2";
    manifest.assets = ["/_next/static/chunks/main-def.js"];
    dispatch("message", { data: { type: "WASL_PRECACHE_REFRESH" } });
    await vi.waitFor(() => expect(cacheMap.has("wasl-shell-build-b2")).toBe(true));

    expect([...cacheMap.keys()]).toEqual(["wasl-shell-build-b2"]);
    const cache = cacheMap.get("wasl-shell-build-b2");
    expect(await cache.match("/_next/static/chunks/main-def.js")).toBeDefined();
    const meta = await (await cache.match("/__wasl-build-meta")).json();
    expect(meta.buildId).toBe("b2");
  });

  it("cleans up legacy WASL caches on activation", async () => {
    cacheMap.set("wasl-shell-v2", { match: async () => undefined, put: async () => {}, entries: new Map() });
    cacheMap.set("lifeos-old", { match: async () => undefined, put: async () => {}, entries: new Map() });

    await runInstall();
    await runActivate();

    expect([...cacheMap.keys()]).toEqual(["wasl-shell-build-b1"]);
  });
});

describe("service worker RSC payload handling", () => {
  it("caches full RSC navigations under a normalized key without the _rsc cache buster", async () => {
    await installWithManifest();

    const request = new Request(`${ORIGIN}/notes?_rsc=sessionhash`, { headers: { RSC: "1" } });
    const response = await runFetchResponse(request);

    expect(await response.text()).toBe("rsc:/notes?_rsc=sessionhash");
    const cache = cacheMap.get("wasl-shell-build-b1");
    const cached = await cache.match("/__wasl-rsc/notes");
    expect(cached).toBeDefined();
    expect(await cached.text()).toBe("rsc:/notes?_rsc=sessionhash");
  });

  it("never caches prefetch RSC payloads so partial data cannot poison full payloads", async () => {
    await installWithManifest();
    const cache = cacheMap.get("wasl-shell-build-b1");
    const warmBody = await (await cache.match("/__wasl-rsc/notes")).text();

    const request = new Request(`${ORIGIN}/notes?_rsc=x`, {
      headers: { RSC: "1", "Next-Router-Prefetch": "1" },
    });
    const responded = await runFetch(request);

    expect(responded).toBeUndefined();
    const after = await cache.match("/__wasl-rsc/notes");
    expect(await after.text()).toBe(warmBody);
  });

  it("serves warmed RSC payloads when offline and returns 503 for unknown routes", async () => {
    await installWithManifest();
    fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const offlineRequest = new Request(`${ORIGIN}/notes?_rsc=anything`, { headers: { RSC: "1" } });
    const warmed = await runFetchResponse(offlineRequest);
    expect(warmed).toBeDefined();
    expect(warmed.status).toBe(200);
    expect(await warmed.text()).toBe("rsc:/notes");

    const unknownRequest = new Request(`${ORIGIN}/calendar?_rsc=anything`, { headers: { RSC: "1" } });
    const missing = await runFetchResponse(unknownRequest);
    expect(missing.status).toBe(503);
  });
});

describe("service worker navigation handling", () => {
  it("serves cached HTML for visited routes and the offline page for unwarmed routes", async () => {
    await installWithManifest();
    fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const visited = await runFetchResponse(navigateRequest(`${ORIGIN}/notes`));
    expect(visited.status).toBe(200);
    expect(await visited.text()).toBe("html:/notes");

    const unwarmed = await runFetchResponse(navigateRequest(`${ORIGIN}/settings`));
    expect(unwarmed.status).toBe(200);
    expect(await unwarmed.text()).toBe("html:/offline");
  });

  it("never caches redirected navigation responses (e.g. logged-out auth bounces)", async () => {
    fetchImpl = vi.fn(async () => {
      const res = okResponse("html:login", { "Content-Type": "text/html" });
      Object.defineProperty(res, "redirected", { get: () => true });
      return res;
    });

    const response = await runFetchResponse(navigateRequest(`${ORIGIN}/notes`));
    expect(response.status).toBe(200);

    // Redirected responses must never be written into any cache
    expect(cacheMap.size).toBe(0);
  });

  it("returns 503 when offline with no cached fallbacks at all", async () => {
    fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const response = await runFetchResponse(navigateRequest(`${ORIGIN}/notes`));
    expect(response.status).toBe(503);
  });
});

describe("service worker static asset handling", () => {
  it("returns 504 instead of an unresolved response when a chunk is missing offline", async () => {
    await installWithManifest();
    fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const request = new Request(`${ORIGIN}/_next/static/chunks/never-cached.js`);
    const response = await runFetchResponse(request);

    expect(response).toBeDefined();
    expect(response.status).toBe(504);
  });

  it("caches static assets on first fetch and serves them offline afterwards", async () => {
    await installWithManifest();
    const url = `${ORIGIN}/_next/static/chunks/lazy-xyz.js`;

    const online = await runFetchResponse(new Request(url));
    expect(online.status).toBe(200);

    fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const offline = await runFetchResponse(new Request(url));
    expect(offline.status).toBe(200);
    expect(await offline.text()).toBe("asset:/_next/static/chunks/lazy-xyz.js");
  });
});
