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
//   - buildId: .next/BUILD_ID
//   - assets:  every file under .next/static  → /_next/static/**
//   - routes:  every non-dynamic App Router page under app/

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
  const buildId = fs.readFileSync(path.join(nextDir, "BUILD_ID"), "utf8").trim();
  if (!buildId) {
    throw new Error("precache-manifest: .next/BUILD_ID is empty.");
  }

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
  const prerenderManifest = JSON.parse(fs.readFileSync(path.join(nextDir, "prerender-manifest.json"), "utf8"));
  for (const route of Object.keys(prerenderManifest.routes ?? {})) {
    if (!route.startsWith("/_") && route !== "/favicon.ico") {
      routes.add(route);
    }
  }

  return {
    buildId,
    generatedAt: now.toISOString(),
    routes: [...routes].sort(),
    assets,
  };
}

function main() {
  const root = process.cwd();
  const nextDir = path.join(root, ".next");
  const appDir = path.join(root, "app");
  const publicDir = path.join(root, "public");

  if (!fs.existsSync(path.join(nextDir, "BUILD_ID"))) {
    console.error("precache-manifest: .next/BUILD_ID not found — run `next build` first.");
    process.exit(1);
  }

  const manifest = collectPrecacheManifest({ appDir, nextDir });

  fs.mkdirSync(publicDir, { recursive: true });
  const outPath = path.join(publicDir, "precache-manifest.json");
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");

  console.log(
    `precache-manifest: build ${manifest.buildId} → ${manifest.assets.length} assets, ${manifest.routes.length} routes (${path.relative(root, outPath)})`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
