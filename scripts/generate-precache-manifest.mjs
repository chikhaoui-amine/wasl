#!/usr/bin/env node
// Generates public/precache-manifest.json after `next build`.
//
// The service worker (public/sw.js) fetches this manifest at install time and
// after deploys, then precaches every hashed build asset and warms every
// static route (HTML + RSC payload) into a build-scoped cache. This is what
// makes every page of the app work offline instead of only pages that happened
// to be fetched while a service worker was already controlling the tab.
//
// The file is generated (gitignored) because its content is unique per build:
//   - buildId: .next/BUILD_ID, or a hash of the asset list when generated
//              during the build (BUILD_ID is written later)
//   - assets:  every file under .next/static  → /_next/static/**
//   - routes:  every non-dynamic App Router page under app/, plus literal
//              generateStaticParams / prerendered paths
//
// It runs twice: from next.config.ts (compiler.runAfterProductionCompile),
// which is the copy hosting providers like Vercel deploy because they collect
// public/ before post-build scripts run, and again after `next build` (via
// scripts/run-edition.mjs) for self-hosted builds.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PAGE_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);

function walkFiles(dir, visitor) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, visitor);
    } else if (entry.isFile()) {
      visitor(fullPath);
    }
  }
}

/**
 * Concrete URLs for a dynamic page whose generateStaticParams returns a
 * literal list of string params, e.g. `return [{ topicId: "default" }];`.
 * Anything more complex is skipped (the service worker still caches those
 * pages at runtime once visited).
 */
function literalStaticParamRoutes(dir, entries, urlSegments) {
  const page = entries.find(
    (entry) => entry.isFile() && path.parse(entry.name).name === "page" && PAGE_EXTENSIONS.has(path.extname(entry.name)),
  );
  if (!page) return [];
  const source = fs.readFileSync(path.join(dir, page.name), "utf8");
  const match = source.match(/generateStaticParams\s*\([^)]*\)\s*(?::[^{]*)?\{\s*return\s*(\[[^\]]*\])\s*;?\s*\}/);
  if (!match) return [];
  const objects = [...match[1].matchAll(/\{([^}]*)\}/g)];
  const routes = [];
  for (const [, body] of objects) {
    const params = Object.fromEntries(
      [...body.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*["']([^"']*)["']/g)].map(([, key, value]) => [key, value]),
    );
    const resolved = urlSegments.map((segment) => {
      const name = segment.match(/^\[([^\].]+)\]$/)?.[1];
      return name ? params[name] : segment;
    });
    if (resolved.every((segment) => typeof segment === "string" && segment.length > 0)) {
      routes.push("/" + resolved.map(encodeURIComponent).join("/"));
    }
  }
  return routes;
}

/**
 * Collects warmable static routes from the App Router directory.
 * - Route groups `(name)` and intercepts `@name` never appear in URLs → stripped.
 * - Private folders `_name` are not routable → skipped with their subtree.
 * - Dynamic segments `[param]` cannot be warmed with a concrete URL → skipped.
 */
export function collectRoutes(appDir) {
  const routes = new Set();

  const visit = (dir, segments) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const hasPage = entries.some(
      (entry) => entry.isFile() && path.parse(entry.name).name === "page" && PAGE_EXTENSIONS.has(path.extname(entry.name)),
    );
    if (hasPage) {
      const urlSegments = segments.filter((segment) => !segment.startsWith("(") && !segment.startsWith("@"));
      const isDynamic = urlSegments.some((segment) => segment.startsWith("["));
      if (!isDynamic) {
        routes.add("/" + urlSegments.join("/"));
      } else {
        for (const route of literalStaticParamRoutes(dir, entries, urlSegments)) routes.add(route);
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      visit(path.join(dir, entry.name), [...segments, entry.name]);
    }
  };

  visit(appDir, []);
  return [...routes].sort();
}

export function collectPrecacheManifest({ appDir, nextDir, now = new Date() }) {
  const assets = [];
  walkFiles(path.join(nextDir, "static"), (filePath) => {
    const relative = path.relative(nextDir, filePath).split(path.sep).join("/");
    assets.push(`/_next/${relative}`);
  });
  assets.sort();

  const routes = new Set(collectRoutes(appDir));
  // Prerendered dynamic paths (e.g. /learning/default) are not discoverable
  // from the app directory — take them from the prerender manifest. Internal
  // entries (/_not-found, /favicon.ico, ...) are skipped.
  // (Absent while generating mid-build; literal generateStaticParams above
  // already covers those paths.)
  const prerenderPath = path.join(nextDir, "prerender-manifest.json");
  if (fs.existsSync(prerenderPath)) {
    const prerenderManifest = JSON.parse(fs.readFileSync(prerenderPath, "utf8"));
    for (const route of Object.keys(prerenderManifest.routes ?? {})) {
      if (!route.startsWith("/_") && route !== "/favicon.ico") {
        routes.add(route);
      }
    }
  }

  if (assets.length === 0) {
    throw new Error(`precache-manifest: no build assets under ${path.join(nextDir, "static")}.`);
  }
  const buildIdPath = path.join(nextDir, "BUILD_ID");
  const buildId = fs.existsSync(buildIdPath)
    ? fs.readFileSync(buildIdPath, "utf8").trim()
    : crypto.createHash("sha256").update(assets.join("\n")).digest("hex").slice(0, 20);
  if (!buildId) {
    throw new Error("precache-manifest: .next/BUILD_ID is empty.");
  }

  return {
    buildId,
    generatedAt: now.toISOString(),
    routes: [...routes].sort(),
    assets,
  };
}

/** Generate and write public/precache-manifest.json for a finished compile. */
export function writePrecacheManifest({ root = process.cwd(), distDir = ".next" } = {}) {
  const nextDir = path.resolve(root, distDir);
  const manifest = collectPrecacheManifest({ appDir: path.join(root, "app"), nextDir });
  const publicDir = path.join(root, "public");
  fs.mkdirSync(publicDir, { recursive: true });
  const outPath = path.join(publicDir, "precache-manifest.json");
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `precache-manifest: build ${manifest.buildId} → ${manifest.assets.length} assets, ${manifest.routes.length} routes (${path.relative(root, outPath)})`,
  );
  return manifest;
}

function main() {
  const root = process.cwd();
  if (!fs.existsSync(path.join(root, ".next", "static"))) {
    console.error("precache-manifest: .next/static not found — run `next build` first.");
    process.exit(1);
  }
  writePrecacheManifest({ root });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
