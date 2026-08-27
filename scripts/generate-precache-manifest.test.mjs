import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectPrecacheManifest, collectRoutes } from "./generate-precache-manifest.mjs";

let fixtureRoot;

function writeFile(...segments) {
  const full = path.join(fixtureRoot, ...segments);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, "x");
}

beforeEach(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wasl-precache-"));
});

afterEach(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function seedFixture() {
  writeFile(".next", "BUILD_ID");
  fs.writeFileSync(path.join(fixtureRoot, ".next", "BUILD_ID"), "build-123\n");
  writeFile(".next", "static", "chunks", "main-abc.js");
  writeFile(".next", "static", "css", "app.css");
  fs.writeFileSync(
    path.join(fixtureRoot, ".next", "prerender-manifest.json"),
    JSON.stringify({
      routes: {
        "/": {},
        "/notes": {},
        "/learning/default": {},
        "/_not-found": {},
        "/favicon.ico": {},
      },
      dynamicRoutes: {},
    }),
  );
  // App Router routes
  writeFile("app", "page.tsx"); // /
  writeFile("app", "notes", "page.tsx"); // /notes
  writeFile("app", "(auth)", "reset-password", "page.tsx"); // group stripped → /reset-password
  writeFile("app", "_private", "hidden", "page.tsx"); // private folder → skipped
  writeFile("app", "blog", "[slug]", "page.tsx"); // dynamic → skipped
  writeFile("app", "api", "users", "route.ts"); // route handler, no page → skipped
}

describe("precache manifest generation", () => {
  it("collects buildId, hashed assets and warmable routes", () => {
    seedFixture();

    const manifest = collectPrecacheManifest({
      appDir: path.join(fixtureRoot, "app"),
      nextDir: path.join(fixtureRoot, ".next"),
      now: new Date("2026-08-26T00:00:00.000Z"),
    });

    expect(manifest.buildId).toBe("build-123");
    expect(manifest.generatedAt).toBe("2026-08-26T00:00:00.000Z");
    expect(manifest.assets).toEqual([
      "/_next/static/chunks/main-abc.js",
      "/_next/static/css/app.css",
    ]);
    // Prerendered dynamic path /learning/default is merged in; internal
    // prerender entries (/_not-found, /favicon.ico) are excluded.
    expect(manifest.routes).toEqual(["/", "/learning/default", "/notes", "/reset-password"]);
  });

  it("collectRoutes skips private folders, groups are flattened, dynamic routes excluded", () => {
    writeFile("app", "page.tsx");
    writeFile("app", "settings", "page.tsx");
    writeFile("app", "@modal", "preview", "page.tsx"); // intercept → flattened to /preview
    writeFile("app", "admin", "_components", "widget.tsx"); // non-page files ignored

    const routes = collectRoutes(path.join(fixtureRoot, "app"));
    expect(routes).toEqual(["/", "/preview", "/settings"]);
  });

  it("throws when BUILD_ID is missing", () => {
    fs.mkdirSync(path.join(fixtureRoot, ".next"), { recursive: true });
    expect(() =>
      collectPrecacheManifest({
        appDir: path.join(fixtureRoot, "app"),
        nextDir: path.join(fixtureRoot, ".next"),
      }),
    ).toThrow();
  });
});
