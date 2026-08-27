// WASL Service Worker (edition-scoped, manifest-driven)
// WASL Local Service Worker (manifest-driven)
//
// The worker file itself is identical between deploys; the build identity
// comes from /precache-manifest.json (generated after `next build`). When the
// manifest reports a new buildId, this worker precaches every hashed build
// asset and warms every static route (HTML + full RSC payload) into a
// build-scoped cache, then swaps it in and deletes the old one. This is what
// makes every page work offline — chunk availability no longer depends on
// having been fetched once while a previous worker controlled the page.

const CACHE_PREFIX = "wasl-shell";
const FALLBACK_CACHE = `${CACHE_PREFIX}-v3`;
const MANIFEST_URL = "/precache-manifest.json";
const BUILD_META_KEY = "/__wasl-build-meta";
const RSC_KEY_PREFIX = "/__wasl-rsc";
const MANIFEST_CHECK_INTERVAL = 10 * 60 * 1000;

const STATIC_PRECACHE_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-icon.png",
];

let activeCacheName = null;
let adoptInFlight = null;
let lastManifestCheck = 0;

function cacheNameForBuild(buildId) {
  return `${CACHE_PREFIX}-build-${buildId}`;
}

// Cache key for an RSC payload. The `_rsc` query param is a per-session cache
// buster and must not be part of the key, otherwise warmed payloads from an
// earlier session could never be found offline.
function rscKeyFor(pathname, search) {
  const url = new URL(RSC_KEY_PREFIX + pathname, self.location.origin);
  if (search) {
    const params = new URLSearchParams(search);
    params.delete("_rsc");
    const qs = params.toString();
    if (qs) url.search = qs;
  }
  return url.pathname + url.search;
}

// Requests that must NEVER be cached or intercepted
function isExcludedRequest(request, url) {
  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return true;
  }

  // Never cache authorization-bearing requests
  if (request.headers && (request.headers.get("authorization") || request.headers.get("Authorization"))) {
    return true;
  }

  const pathname = url.pathname.toLowerCase();

  return (
    pathname.startsWith("/api/") ||
    pathname.includes("mcp") ||
    pathname.includes("backup") ||
    pathname.includes("transfer") ||
    pathname.endsWith(".wasl-backup") ||
    pathname.endsWith(".wasl-transfer") ||
    (pathname.endsWith(".json") && !pathname.endsWith("manifest.webmanifest")) ||
    url.protocol === "blob:" ||
    url.protocol === "data:"
  );
}

async function fetchAndCache(cache, url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (res && res.ok && !res.redirected) {
    await cache.put(url, res);
  }
}

// Warm one route so it works offline:
// - the SSR HTML document  → offline deep links / hard loads of the route
// - the full RSC payload   → offline client-side navigation to the route
async function warmRoute(cache, route) {
  try {
    await fetchAndCache(cache, route);
  } catch {}
  try {
    const res = await fetch(route, { headers: { RSC: "1" }, cache: "no-cache" });
    if (res && res.ok && !res.redirected) {
      await cache.put(rscKeyFor(route, ""), res);
    }
  } catch {}
}

async function readManifest() {
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
    if (!res || !res.ok) return null;
    const manifest = await res.json();
    if (!manifest || typeof manifest.buildId !== "string" || manifest.buildId.trim() === "") return null;
    if (!Array.isArray(manifest.assets)) return null;
    return manifest;
  } catch {
    return null;
  }
}

// Resolve the cache to serve from: the newest build cache that finished
// adopting (marked by a build-meta entry), or the static fallback shell.
async function readActiveCacheName() {
  if (activeCacheName) return activeCacheName;
  let best = null;
  let bestAt = "";
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      if (!key.startsWith(`${CACHE_PREFIX}-build-`)) continue;
      const cache = await caches.open(key);
      const metaRes = await cache.match(BUILD_META_KEY);
      if (!metaRes) continue;
      try {
        const meta = await metaRes.json();
        const at = typeof meta?.generatedAt === "string" ? meta.generatedAt : "";
        if (!best || at > bestAt) {
          best = key;
          bestAt = at;
        }
      } catch {}
    }
  } catch {}
  activeCacheName = best || FALLBACK_CACHE;
  return activeCacheName;
}

async function cleanupOldCaches(keepName) {
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        if ((key.startsWith("wasl-") || key.startsWith("lifeos-")) && key !== keepName) {
          return caches.delete(key);
        }
        return Promise.resolve();
      }),
    );
  } catch {}
}

// Precache the manifest's build into a build-scoped cache and swap it in.
// The swap only happens after every asset and route warmed successfully
// enough (individual failures are tolerated), so an interrupted adoption
// never leaves the active cache half-populated.
async function adoptLatestManifest() {
  if (adoptInFlight) return adoptInFlight;
  adoptInFlight = (async () => {
    try {
      const manifest = await readManifest();
      if (!manifest) return;
      const target = cacheNameForBuild(manifest.buildId);
      const current = await readActiveCacheName();
      if (current === target) return;

      const cache = await caches.open(target);
      const assets = [...manifest.assets, ...STATIC_PRECACHE_ASSETS];
      await Promise.allSettled(assets.map((asset) => fetchAndCache(cache, asset)));
      const routes = Array.isArray(manifest.routes) ? manifest.routes : [];
      await Promise.allSettled(routes.map((route) => warmRoute(cache, route)));

      await cache.put(
        BUILD_META_KEY,
        new Response(JSON.stringify({ buildId: manifest.buildId, generatedAt: manifest.generatedAt || "" })),
      );
      activeCacheName = target;
      await cleanupOldCaches(target);
    } catch {
      // Manifest unavailable (dev server or offline first install): the
      // fallback shell cache keeps the app usable until the next online visit.
    } finally {
      adoptInFlight = null;
    }
  })();
  return adoptInFlight;
}

function maybeAdoptLatestManifest() {
  const now = Date.now();
  if (now - lastManifestCheck < MANIFEST_CHECK_INTERVAL) return;
  lastManifestCheck = now;
  adoptLatestManifest();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(FALLBACK_CACHE);
      await Promise.allSettled(STATIC_PRECACHE_ASSETS.map((asset) => fetchAndCache(cache, asset)));
      await adoptLatestManifest();
      // Do not force skipWaiting automatically so in-flight edits are never lost
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await readActiveCacheName();
      await cleanupOldCaches(activeCacheName);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data.type === "WASL_PRECACHE_REFRESH") {
    adoptLatestManifest();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Strictly exclude non-GET, cross-origin, auth, API, MCP, and backup traffic
  if (isExcludedRequest(request, url)) {
    return;
  }

  // 1. RSC payload requests (App Router client-side navigation) → Network-first
  //    with a cache fallback, keyed by route path with the volatile `_rsc`
  //    cache-buster stripped. Prefetch payloads are partial and must never
  //    overwrite full navigation payloads.
  if (request.headers.get("RSC") === "1") {
    if (request.headers.get("Next-Router-Prefetch") === "1") {
      return;
    }
    const key = rscKeyFor(url.pathname, url.search);
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok && !networkResponse.redirected) {
            const cache = await caches.open(await readActiveCacheName());
            await cache.put(key, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cache = await caches.open(await readActiveCacheName());
          const cachedResponse =
            (await cache.match(key)) || (await cache.match(key, { ignoreSearch: true }));
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response("", { status: 503, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  // 2. Navigation requests (HTML pages) -> Network-First with Cache Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          maybeAdoptLatestManifest();
          // Never cache auth redirects (e.g. logged-out warm fetches) over app pages
          if (networkResponse.ok && !networkResponse.redirected) {
            const cache = await caches.open(await readActiveCacheName());
            await cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cache = await caches.open(await readActiveCacheName());
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Offline deep-link: only the root navigation may fall back to "/",
          // otherwise /tasks would silently render the home page under the
          // wrong URL. Any other route goes to the offline page.
          if (url.pathname === "/") {
            const rootFallback = await cache.match("/");
            if (rootFallback) {
              return rootFallback;
            }
          }
          const offlineFallback = await cache.match("/offline");
          if (offlineFallback) {
            return offlineFallback;
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  // 3. Static Next.js assets (_next/static, fonts, icons, styles) -> Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(await readActiveCacheName());
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              cache.put(request, networkResponse.clone()).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => null);

        if (cachedResponse) {
          return cachedResponse;
        }
        const networkResponse = await fetchPromise;
        if (networkResponse) {
          return networkResponse;
        }
        // Cache miss + network failure must be a real response, never an
        // unresolved promise (which surfaces as "Failed to load chunk").
        return new Response("", { status: 504, statusText: "Offline" });
      })(),
    );
    return;
  }

  // 4. Any other requests -> Passthrough without caching
});
