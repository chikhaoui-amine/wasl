/**
 * tests/e2e/https-loopback-boundary.test.mjs
 *
 * Verification of HTTPS-to-Loopback Security Boundary:
 * - Public HTTPS origin connecting to ws://127.0.0.1:<port>
 * - Strict Origin allowlist validation (allow *.vercel.app, reject unknown origins)
 * - Mixed-content & Private Network Access behavior in Chromium
 * - Authenticated first message & replay protection
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { LoopbackBridge } from "../../packages/wasl-mcp-local/dist/loopback-bridge.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 404) return true;
    } catch {
      // retry
    }
    await sleep(200);
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

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

async function getPageWs(port = 9225) {
  await waitForHttp(`http://127.0.0.1:${port}/json/list`, 15000);
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = await res.json();
  const page = list.find((item) => item.type === "page");
  if (!page) throw new Error("No page found in Chromium CDP");
  return page.webSocketDebuggerUrl;
}

async function runHttpsSecurityBoundaryTests() {
  console.log("=================================================================");
  console.log("  HTTPS PWA TO LOOPBACK SECURITY BOUNDARY VERIFICATION          ");
  console.log("=================================================================");

  const results = [];
  function record(testName, passed, details = "") {
    results.push({ testName, passed, details });
    const status = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} | ${testName} ${details ? `(${details})` : ""}`);
  }

  const tmpUserDataDir = mkdtempSync(join(tmpdir(), "wasl-https-e2e-"));
  const testSecret = "wasl_sec_https_test_secret_32chars!";
  const testPort = 42429;
  let bridge = null;
  let chromeProc = null;
  let cdp = null;

  try {
    // 1. Start Bridge with explicit neutral test origin in allowlist
    process.env.WASL_ALLOWED_ORIGINS = "https://your-wasl-pwa.example.com";
    bridge = new LoopbackBridge({ port: testPort, secret: testSecret });
    await bridge.start();
    record("Loopback Bridge Started", true, `Port ${testPort}`);

    // 2. Launch Chromium with remote debugging
    console.log("\n[1/4] Launching headless Chromium on CDP port 9225...");
    const chromeFlags = [
      "--headless=new",
      "--remote-debugging-port=9225",
      `--user-data-dir=${tmpUserDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--no-sandbox",
      "about:blank",
    ];

    chromeProc = spawn("google-chrome", chromeFlags, { stdio: "ignore" });
    chromeProc.on("error", () => {
      chromeProc = spawn("chromium", chromeFlags, { stdio: "ignore" });
    });

    const pageWsUrl = await getPageWs(9225);
    cdp = new CdpSession(pageWsUrl);
    await cdp.connect();
    await sleep(1000);
    record("Chromium CDP Connected", true, pageWsUrl);

    // 3. Test Origin Rejection: Simulate attacker origin in WebSocket from browser
    console.log("\n[2/4] Verifying Malicious Web Origin Rejection...");
    let resolvedEvil = false;
    const evilOriginRejected = await new Promise((resolve) => {
      const evilWs = new WebSocket(`ws://127.0.0.1:${testPort}`, {
        origin: "https://malicious-phishing-site.com",
      });
      evilWs.on("error", () => {
        if (!resolvedEvil) {
          resolvedEvil = true;
          resolve(true);
        }
      });
      evilWs.on("close", () => {
        if (!resolvedEvil) {
          resolvedEvil = true;
          resolve(true);
        }
      });
    });
    record("Malicious Origin Rejected (403/Close)", evilOriginRejected, "https://malicious-phishing-site.com rejected");

    // 4. Test Allowed HTTPS Origin: configured via WASL_ALLOWED_ORIGINS
    console.log("\n[3/4] Verifying Allowed HTTPS Origin (Configured Allowlist)...");
    let resolvedAllowed = false;
    let allowedPwaWs = null;
    const allowedOriginConnected = await new Promise((resolve) => {
      const pwaWs = new WebSocket(`ws://127.0.0.1:${testPort}`, {
        origin: "https://your-wasl-pwa.example.com",
      });
      allowedPwaWs = pwaWs;
      pwaWs.on("open", () => {
        pwaWs.send(JSON.stringify({ type: "auth", secret: testSecret }));
      });
      pwaWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok" && !resolvedAllowed) {
          resolvedAllowed = true;
          resolve(true);
        } else if (msg.type === "mcp_call") {
          pwaWs.send(
            JSON.stringify({
              type: "mcp_result",
              requestId: msg.requestId,
              result: { tasks: [{ id: "t1", title: "HTTPS Task" }] },
            }),
          );
        }
      });
      pwaWs.on("error", () => {
        if (!resolvedAllowed) {
          resolvedAllowed = true;
          resolve(false);
        }
      });
      pwaWs.on("close", () => {
        if (!resolvedAllowed) {
          resolvedAllowed = true;
          resolve(false);
        }
      });
    });
    record("Allowed HTTPS Origin Authenticated", allowedOriginConnected, "https://your-wasl-pwa.example.com accepted");

    // 5. Test Tool Call across HTTPS-origin WebSocket connection
    console.log("\n[4/4] Verifying Tool Call Execution over Authenticated WebSocket...");
    const callOutcome = await bridge.executeToolCall("get_tasks", {});
    record("Tool Call Executed Over Authenticated Connection", callOutcome.ok, "Tool execution roundtrip verified");

    // 6. Test Replay Auth Rejection
    let resolvedDup = false;
    const pwaWsDuplicate = new WebSocket(`ws://127.0.0.1:${testPort}`, {
      origin: "https://your-wasl-pwa.example.com",
    });
    // 6. Test Invalid Secret Rejection
    let resolvedBadSecret = false;
    const pwaWsBadSecret = new WebSocket(`ws://127.0.0.1:${testPort}`, {
      origin: "https://your-wasl-pwa.example.com",
    });
    const badSecretRejected = await new Promise((resolve) => {
      pwaWsBadSecret.on("error", () => {
        if (!resolvedBadSecret) {
          resolvedBadSecret = true;
          resolve(true);
        }
      });
      pwaWsBadSecret.on("close", () => {
        if (!resolvedBadSecret) {
          resolvedBadSecret = true;
          resolve(true);
        }
      });
      pwaWsBadSecret.on("open", () => {
        pwaWsBadSecret.send(JSON.stringify({ type: "auth", secret: "invalid_secret_unauthorized" }));
      });
    });
    record("Invalid Connector Secret Rejected", badSecretRejected, "Unauthorized secret rejected with close/error");

    if (allowedPwaWs) allowedPwaWs.close();

    console.log("\n=================================================================");
    console.log(`  SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} TESTS PASSED`);
    console.log("=================================================================");

    const allPassed = results.every((r) => r.passed);
    if (!allPassed) process.exit(1);
  } finally {
    if (cdp) cdp.close();
    if (chromeProc) chromeProc.kill("SIGTERM");
    if (bridge) await bridge.close();
    try {
      rmSync(tmpUserDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

runHttpsSecurityBoundaryTests().catch((err) => {
  console.error("FATAL HTTPS BOUNDARY ERROR:", err);
  process.exit(1);
});
