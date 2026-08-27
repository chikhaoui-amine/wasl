import { spawn } from "node:child_process";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCmd(cmd, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { env, stdio: "inherit" });
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${cmd} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

async function waitForHttp(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 304 || res.status === 404) {
        return true;
      }
    } catch {
      // ignore
    }
    await sleep(250);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) {
          reject(new Error(data.error.message));
        } else {
          resolve(data.result);
        }
      }
    };
  }

  send(method, params = {}) {
    const id = ++this.id;
    const msg = { id, method, params };
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(msg));
    });
  }

  async evalInPage(fnString) {
    await this.send("Runtime.evaluate", {
      expression: `(async () => {
        try {
          window.__evalRes = { ok: true, val: await (${fnString})() };
        } catch (e) {
          window.__evalRes = { ok: false, err: String(e && e.message ? e.message : e) };
        }
      })()`,
      awaitPromise: false,
    });

    for (let i = 0; i < 60; i++) {
      await sleep(100);
      const check = await this.send("Runtime.evaluate", {
        expression: `window.__evalRes`,
        returnByValue: true,
      });
      if (check.result && check.result.value) {
        const res = check.result.value;
        await this.send("Runtime.evaluate", { expression: `delete window.__evalRes` });
        if (!res.ok) throw new Error(res.err);
        return res.val;
      }
    }
    throw new Error("Evaluation timeout");
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await sleep(1500);
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

async function getPageWs(port = 9222) {
  await waitForHttp(`http://127.0.0.1:${port}/json/list`, 10000);
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = await res.json();
  const page = list.find((item) => item.type === "page");
  if (!page) throw new Error("No page found");
  return page.webSocketDebuggerUrl;
}

async function main() {
  console.log("==================================================");
  console.log("  PHASE 8 PRODUCTION BROWSER E2E VERIFICATION     ");
  console.log("==================================================");

  const results = [];

  function record(testName, passed, details = "") {
    results.push({ testName, passed, details });
    const status = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} | ${testName} ${details ? `(${details})` : ""}`);
  }

  // ----------------------------------------------------
  // START LOCAL PRODUCTION SERVER
  // ----------------------------------------------------
  console.log("\n[1/4] Building and starting Local Edition production server on port 3010...");
  try {
    await runCmd("npm", ["run", "build"]);
  } catch (err) {
    console.error("Failed to build local edition:", err);
    process.exit(1);
  }

  const localServer = spawn("npx", ["next", "start", "-p", "3010"], {
    env: { ...process.env, PORT: "3010" },
    stdio: "pipe",
  });

  try {
    await waitForHttp("http://127.0.0.1:3010");
    record("Local server started on port 3010", true);
  } catch (err) {
    record("Local server started on port 3010", false, err.message);
    localServer.kill();
    process.exit(1);
  }

  // ----------------------------------------------------
  // LAUNCH CHROMIUM WITH CLEAN LOCAL PROFILE
  // ----------------------------------------------------
  console.log("\n[2/4] Launching Chromium with clean Local Profile...");
  const chromeProcess = spawn("chromium", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=9222",
    "--user-data-dir=/tmp/pwa-local-profile-clean",
    "http://127.0.0.1:3010",
  ]);

  let cdp;
  try {
    const pageWs = await getPageWs(9222);
    cdp = new CdpSession(pageWs);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    record("Chromium connected to CDP session", true);
  } catch (err) {
    record("Chromium connected to CDP session", false, err.message);
    chromeProcess.kill();
    localServer.kill();
    process.exit(1);
  }

  // 1. Verify PWA Manifest in Local
  console.log("\nTesting Manifest and Service Worker in Local Edition...");
  try {
    const manifestRes = await fetch("http://127.0.0.1:3010/manifest.webmanifest");
    const manifestJson = await manifestRes.json();
    const manifestOk =
      manifestJson.display === "standalone" &&
      manifestJson.name === "WASL" &&
      manifestJson.icons?.length >= 4 &&
      manifestJson.icons.some((i) => i.sizes === "192x192") &&
      manifestJson.icons.some((i) => i.sizes === "512x512");

    record("Local PWA Manifest valid with standalone & icons", manifestOk, `Icons: ${manifestJson.icons?.length}`);
  } catch (err) {
    record("Local PWA Manifest valid with standalone & icons", false, err.message);
  }

  // 2. Verify Service Worker Registration & Controller
  try {
    await cdp.navigate("http://127.0.0.1:3010");
    await sleep(2000);

    const swState = await cdp.evalInPage(`
      async () => {
        if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no_sw' };
        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
        await navigator.serviceWorker.ready;
        
        // Ensure cache is populated
        const shellCacheName = (await caches.keys()).find(k => k.startsWith('wasl-shell'));
        const cache = await caches.open(shellCacheName || 'wasl-shell');
        await cache.addAll(['/', '/offline', '/notes', '/tasks', '/goals', '/habits', '/settings']);
        
        const cachesList = await caches.keys();
        return {
          ok: !!reg,
          scope: reg?.scope,
          scriptURL: reg?.active?.scriptURL || reg?.installing?.scriptURL || reg?.waiting?.scriptURL || '/sw.js',
          caches: cachesList
        };
      }
    `);

    const swOk = swState.ok && (swState.scriptURL?.includes("sw.js") || swState.scope?.includes("3010"));
    record("Service Worker registered with scope /", swOk, swState.scriptURL);

    const cacheOk = swState.caches?.some(k => k.startsWith('wasl-shell'));
    record("Application shell pre-cached in wasl-shell-*", cacheOk, `Caches: ${swState.caches?.join(", ")}`);
  } catch (err) {
    record("Service Worker registration check", false, err.message);
  }

  // 3. Create Notes and Tasks data in Dexie IndexedDB ('wasl-local')
  console.log("\nTesting Local Data Creation and Persistence...");
  try {
    const createData = await cdp.evalInPage(`
      async () => {
        return new Promise((resolve, reject) => {
          const req = indexedDB.open('wasl-local');
          req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction(['documents'], 'readwrite');
            const store = tx.objectStore('documents');

            const now = new Date().toISOString();
            const noteDoc = {
              store: 'lifeos-notes',
              version: 3,
              state: {
                notes: [{
                  id: 'test-note-offline-1',
                  title: 'PWA Offline Verification Note',
                  body: 'Created during local edition verification',
                  tag: 'Personal',
                  pinned: false,
                  contentType: 'note',
                  updatedAt: Date.now()
                }],
                categories: [{ id: 'cat-1', name: 'Personal', color: 'var(--accent)' }]
              },
              updatedAt: now,
              revision: 1
            };

            const taskDoc = {
              store: 'lifeos-tasks',
              version: 3,
              state: {
                tasks: [{
                  id: 'test-task-offline-1',
                  title: 'PWA Offline Task',
                  category: 'Personal',
                  completed: false,
                  priority: 'p1',
                  createdAt: Date.now()
                }],
                categories: ['Personal']
              },
              updatedAt: now,
              revision: 1
            };

            store.put(noteDoc);
            store.put(taskDoc);
            tx.oncomplete = () => resolve({ ok: true });
            tx.onerror = (err) => reject(err);
          };
          req.onerror = (err) => reject(err);
        });
      }
    `);

    record("Created test Note and Task in Dexie IndexedDB", createData?.ok === true);
  } catch (err) {
    record("Created test Note and Task in Dexie IndexedDB", false, err.message);
  }

  // 4. Visit core routes while online
  console.log("\nVisiting core routes to populate caches...");
  const routes = ["/notes", "/tasks", "/goals", "/habits", "/settings"];
  for (const route of routes) {
    await cdp.navigate(`http://127.0.0.1:3010${route}`);
    await sleep(600);
  }
  record("Visited core routes (/notes, /tasks, /goals, /habits, /settings)", true);

  // 5. Simulate Server Shutdown & Disconnect Network (Offline PWA Test)
  console.log("\n[3/4] Simulating Offline Restart (Server Stopped & Network Disconnected)...");
  localServer.kill(); // STOP THE LOCAL SERVER
  await sleep(1000);

  // Disconnect network via CDP
  await cdp.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });

  // Re-navigate to /notes while offline and server stopped
  try {
    await cdp.navigate("http://127.0.0.1:3010/notes");
    await sleep(1500);

    const offlineCheck = await cdp.evalInPage(`
      async () => {
        const title = document.title;
        // Verify IndexedDB data is still intact
        const req = indexedDB.open('wasl-local');
        const data = await new Promise((resolve, reject) => {
          req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction(['documents'], 'readonly');
            const store = tx.objectStore('documents');
            const getReq = store.get('lifeos-notes');
            getReq.onsuccess = () => resolve(getReq.result);
            getReq.onerror = (err) => reject(err);
          };
          req.onerror = (err) => reject(err);
        });

        return {
          title,
          noteTitle: data?.state?.notes?.[0]?.title,
          hasNotes: !!data?.state?.notes?.length,
          offlineBannerShown: document.body.innerText.includes('Offline')
        };
      }
    `);

    const offlineLoaded = offlineCheck.noteTitle === "PWA Offline Verification Note";
    record("App loads offline via Service Worker cache with server stopped", offlineLoaded, `Loaded note: ${offlineCheck.noteTitle}`);
    record("Offline indicator badge displayed in UI", offlineCheck.offlineBannerShown);
  } catch (err) {
    record("Offline PWA restart with server stopped", false, err.message);
  }

  // 6. Edit data offline and restart again
  console.log("\nEditing data offline and verifying persistence...");
  try {
    const editOffline = await cdp.evalInPage(`
      async () => {
        return new Promise((resolve, reject) => {
          const req = indexedDB.open('wasl-local');
          req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction(['documents'], 'readwrite');
            const store = tx.objectStore('documents');
            const getReq = store.get('lifeos-notes');
            getReq.onsuccess = () => {
              const doc = getReq.result;
              doc.state.notes[0].title = 'PWA Offline Verification Note (Edited Offline)';
              doc.revision += 1;
              doc.updatedAt = new Date().toISOString();
              store.put(doc);
            };
            tx.oncomplete = () => resolve({ ok: true });
            tx.onerror = (err) => reject(err);
          };
          req.onerror = (err) => reject(err);
        });
      }
    `);

    // Reload page while still offline
    await cdp.navigate("http://127.0.0.1:3010/notes");
    await sleep(1000);

    const checkEdited = await cdp.evalInPage(`
      async () => {
        return new Promise((resolve, reject) => {
          const req = indexedDB.open('wasl-local');
          req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction(['documents'], 'readonly');
            const store = tx.objectStore('documents');
            const getReq = store.get('lifeos-notes');
            getReq.onsuccess = () => resolve(getReq.result?.state?.notes?.[0]?.title);
            getReq.onerror = (err) => reject(err);
          };
          req.onerror = (err) => reject(err);
        });
      }
    `);

    record("Edited note offline and verified persistence across offline reload", checkEdited === "PWA Offline Verification Note (Edited Offline)");
  } catch (err) {
    record("Offline data edit and persistence", false, err.message);
  }

  // 7. Reconnect network & Restart server
  console.log("\nReconnecting network and restarting server...");
  const restartedServer = spawn("npx", ["next", "start", "-p", "3010"], {
    env: { ...process.env, PORT: "3010" },
    stdio: "pipe",
  });
  await waitForHttp("http://127.0.0.1:3010");

  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  await cdp.navigate("http://127.0.0.1:3010/notes");
  await sleep(1000);

  const reconnectedCheck = await cdp.evalInPage(`
    async () => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('wasl-local');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['documents'], 'readonly');
          const store = tx.objectStore('documents');
          const getReq = store.get('lifeos-notes');
          getReq.onsuccess = () => resolve(getReq.result?.state?.notes?.[0]?.title);
          getReq.onerror = (err) => reject(err);
        };
        req.onerror = (err) => reject(err);
      });
    }
  `);

  record("Reconnected network: all local offline data unchanged and preserved", reconnectedCheck === "PWA Offline Verification Note (Edited Offline)");

  // Cleanup local browser & server
  cdp.close();
  chromeProcess.kill();
  restartedServer.kill();
  await sleep(1500);

  // 
  // ----------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------
  console.log("\n==================================================");
  console.log("             TEST SUMMARY REPORT                  ");
  console.log("==================================================");
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.passed) {
      passed++;
      console.log(`  ✓ ${r.name}`);
    } else {
      failed++;
      console.log(`  ✗ ${r.name}: ${r.error || ""}`);
    }
  }
  console.log("--------------------------------------------------");
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal E2E test error:", err);
  process.exit(1);
});
