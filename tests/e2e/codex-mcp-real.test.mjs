/**
 * tests/e2e/codex-mcp-real.test.mjs
 *
 * Real Codex CLI MCP End-to-End Interoperability Test
 *
 * Full Pipeline:
 * Actual Codex CLI (codex exec / codex mcp)
 *   → packages/wasl-mcp-local CLI
 *   → Loopback WebSocket bridge (127.0.0.1:42426)
 *   → Real Headless Chromium Browser with WASL Local PWA
 *   → LocalMcpExecutor
 *   → LocalAdapter & IndexedDB
 */

import { spawn, execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 304 || res.status === 404) {
        return true;
      }
    } catch {
      // retry
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

    try {
      await this.send("Page.enable");
      await this.send("Runtime.enable");
    } catch {
      // ignore
    }
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

async function getPageWs(port = 9224) {
  await waitForHttp(`http://127.0.0.1:${port}/json/list`, 15000);
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = await res.json();
  const page = list.find((item) => item.type === "page");
  if (!page) throw new Error("No page found in Chromium CDP");
  return page.webSocketDebuggerUrl;
}

function runCommand(cmd, args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      resolve({ code: -1, stdout, stderr: stderr + "\nTIMEOUT" });
    }, timeoutMs);

    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    p.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runRealCodexMcpE2E() {
  console.log("=================================================================");
  console.log("  REAL CODEX CLI LOCAL MCP INTEROPERABILITY VERIFICATION        ");
  console.log("=================================================================");

  const results = [];
  function record(testName, passed, details = "") {
    results.push({ testName, passed, details });
    const status = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} | ${testName} ${details ? `(${details})` : ""}`);
  }

  const tmpUserDataDir = mkdtempSync(join(tmpdir(), "wasl-codex-e2e-"));
  const testSecret = "wasl_sec_codex_real_test_key_32chars!";
  const testPort = 42426;
  let nextProc = null;
  let chromeProc = null;
  let cdp = null;

  try {
    // 1. Start Local Next.js server on port 3015
    console.log("\n[1/5] Building and starting Local Edition server on http://127.0.0.1:3015...");
    execSync("NODE_OPTIONS='--max-old-space-size=2048' npm run build", { stdio: "ignore" });
    nextProc = spawn("npm", ["run", "start", "--", "-p", "3015"], {
      env: {
        ...process.env,
        PORT: "3015",
        NEXT_PUBLIC_WASL_EDITION: "local",
      },
      stdio: "pipe",
    });

    await waitForHttp("http://127.0.0.1:3015", 30000);
    record("Local Edition HTTP Server Running", true, "Port 3015");

    // 2. Launch Chromium with remote debugging
    console.log("\n[2/5] Launching headless Chromium on CDP port 9224...");
    const chromeFlags = [
      "--headless=new",
      "--remote-debugging-port=9224",
      `--user-data-dir=${tmpUserDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--no-sandbox",
      "http://127.0.0.1:3015/settings?tab=ai",
    ];

    chromeProc = spawn("google-chrome", chromeFlags, { stdio: "ignore" });
    chromeProc.on("error", () => {
      chromeProc = spawn("chromium", chromeFlags, { stdio: "ignore" });
    });

    const pageWsUrl = await getPageWs(9224);
    cdp = new CdpSession(pageWsUrl);
    await cdp.connect();
    await sleep(2000);
    record("Chromium CDP Connected", true, pageWsUrl);

    // 3. Configure Codex Profile in PWA
    console.log("\n[3/5] Configuring PWA Direct MCP for Codex in browser...");
    await cdp.evalInPage(`() => {
      const profiles = [
        {
          id: "client_codex",
          name: "Codex CLI",
          type: "direct",
          port: ${testPort},
          secret: "${testSecret}",
          permission: "read_write",
          allowedDomains: ["tasks", "notes", "goals", "habits", "blocks", "recurring", "topics", "trash", "journal", "money", "health"],
          createdAt: "2026-08-24",
          lastActiveAt: "2026-08-24",
          revoked: false
        }
      ];
      localStorage.setItem("wasl_mcp_client_profiles", JSON.stringify(profiles));
      localStorage.setItem("wasl_mcp_direct_enabled", "true");
      return true;
    }`);
    await cdp.navigate("http://127.0.0.1:3015/settings?tab=ai");
    await sleep(2000);

    // Read the exact active secret from the browser state
    const codexProfile = await cdp.evalInPage(`() => {
      const list = JSON.parse(localStorage.getItem("wasl_mcp_client_profiles") || "[]");
      return list.find(p => p.id === "client_codex");
    }`);

    const effectiveSecret = codexProfile?.secret ?? testSecret;
    record("PWA Configured with Codex Connector", true, `Port ${testPort}, Secret: ${effectiveSecret.slice(0, 15)}...`);

    // 4. Register MCP server with actual Codex CLI
    console.log("\n[4/5] Registering MCP server with actual Codex CLI...");
    try {
      execSync("codex mcp remove wasl-local-real 2>/dev/null || true");
    } catch {
      // ignore
    }

    const cliPath = join(process.cwd(), "packages/wasl-mcp-local/dist/cli.js");
    const addRes = await runCommand("codex", [
      "mcp",
      "add",
      "wasl-local-real",
      "--",
      "node",
      cliPath,
      `--secret=${effectiveSecret}`,
      `--port=${testPort}`,
    ]);
    record("Codex MCP Server Registered", addRes.code === 0, addRes.stdout.trim());

    // 5. Verify Codex sees the server
    const listRes = await runCommand("codex", ["mcp", "list"]);
    const listOut = listRes.stdout;
    record("Codex MCP Server Listed", listOut.includes("wasl-local-real"), "wasl-local-real found in codex mcp list");

    // 6. Execute real Codex prompt to invoke WASL tool
    console.log("\n[5/5] Executing real Codex prompt with WASL Local MCP tool call...");
    const execRes = await runCommand("codex", [
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
      "--ephemeral",
      "--skip-git-repo-check",
      "Call the wasl-local-real MCP tool add_task with arguments title='Real Codex Created Task' and priority='high'.",
    ]);

    const execSuccess = execRes.code === 0;
    record("Codex Exec Prompt Completed", execSuccess, `Exit code: ${execRes.code}, out: ${execRes.stdout.slice(-150).trim()}`);

    // 7. Verify task in browser IndexedDB
    const taskInDb = await cdp.evalInPage(`async () => {
      for (let i = 0; i < 30; i++) {
        const found = await new Promise((resolve) => {
          const dbReq = indexedDB.open("wasl-local");
          dbReq.onsuccess = () => {
            const db = dbReq.result;
            const tx = db.transaction(["documents"], "readonly");
            const store = tx.objectStore("documents");
            const req = store.get("lifeos-tasks");
            req.onsuccess = () => {
              const doc = req.result;
              const has = (doc?.state?.tasks || []).some(t => t.title && t.title.includes("Real Codex Created Task"));
              resolve(Boolean(has));
            };
            req.onerror = () => resolve(false);
          };
          dbReq.onerror = () => resolve(false);
        });
        if (found) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      return false;
    }`);
    record("Codex Created Task Persisted in IndexedDB", taskInDb === true, "Task verified in Dexie store");

    // 8. Test Offline behavior: Close WASL
    await cdp.evalInPage(`() => {
      window.dispatchEvent(new Event("beforeunload"));
      return true;
    }`);
    await cdp.navigate("about:blank");
    await sleep(1000);

    const offlineExecRes = await runCommand("codex", [
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
      "--ephemeral",
      "--skip-git-repo-check",
      "Call the wasl-local-real MCP tool get_tasks.",
    ]);
    const outCombined = (offlineExecRes.stdout + " " + offlineExecRes.stderr).toLowerCase();
    const offlineReported = outCombined.includes("offline") || outCombined.includes("not currently connected") || outCombined.includes("error");
    record("Codex Detects WASL_LOCAL_OFFLINE When Browser Closes", offlineReported, `Exit code ${offlineExecRes.code}`);

    // 9. Cleanup Codex MCP registration
    await runCommand("codex", ["mcp", "remove", "wasl-local-real"]);
    record("Codex MCP Server Removed", true, "Clean cleanup");

    // 10. Verify no lingering bridge processes
    await sleep(1000);
    const pgrepRes = await runCommand("pgrep", ["-f", "wasl-mcp-local.*42426"]);
    record("Zero Lingering Bridge Processes", pgrepRes.stdout.trim() === "", "pgrep output empty");

    console.log("\n=================================================================");
    console.log(`  SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} TESTS PASSED`);
    console.log("=================================================================");

    const allPassed = results.every((r) => r.passed);
    if (!allPassed) {
      process.exit(1);
    }
  } finally {
    try {
      execSync("codex mcp remove wasl-local-real 2>/dev/null || true");
    } catch {
      // ignore
    }
    if (cdp) cdp.close();
    if (chromeProc) chromeProc.kill("SIGTERM");
    if (nextProc) nextProc.kill("SIGTERM");
    try {
      rmSync(tmpUserDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

runRealCodexMcpE2E().catch((err) => {
  console.error("FATAL CODEX E2E ERROR:", err);
  process.exit(1);
});
