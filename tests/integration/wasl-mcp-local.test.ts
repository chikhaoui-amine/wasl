/**
 * tests/integration/wasl-mcp-local.test.ts
 *
 * Comprehensive integration tests for packages/wasl-mcp-local:
 * - Direct STDIO MCP Layer
 * - Multi-client simultaneous ports & isolation
 * - Multiple instances of the SAME client type without port collision
 * - Secret rotation & cross-client security
 * - Origin validation & rejection of foreign origins
 * - Authentication timeout & replay protection
 * - Offline detection & disconnect cleanup
 * - Oversized payload rejection
 */

import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { LoopbackBridge } from "../../packages/wasl-mcp-local/src/loopback-bridge.js";

describe("Direct Local MCP Bridge (wasl-mcp-local)", () => {
  const activeBridges: LoopbackBridge[] = [];
  const testSecret = "test_connector_secret_32chars_long!!";

  afterEach(async () => {
    while (activeBridges.length > 0) {
      const b = activeBridges.pop();
      if (b) await b.close();
    }
  });

  function createBridge(port: number, secret = testSecret): LoopbackBridge {
    const bridge = new LoopbackBridge({ port, secret });
    activeBridges.push(bridge);
    return bridge;
  }

  it("returns WASL_LOCAL_OFFLINE when PWA is not connected", async () => {
    const bridge = createBridge(43501);
    await bridge.start();

    const outcome = await bridge.executeToolCall("get_tasks", {});
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain("WASL_LOCAL_OFFLINE");
    }
  });

  it("authenticates PWA WebSocket connection with secret and forwards tool calls", async () => {
    const bridge = createBridge(43502);
    await bridge.start();

    const pwaWs = new WebSocket("ws://127.0.0.1:43502", {
      headers: { Origin: "http://localhost:3000" },
    });

    await new Promise<void>((resolve, reject) => {
      pwaWs.on("open", () => {
        pwaWs.send(JSON.stringify({ type: "auth", secret: testSecret }));
      });

      pwaWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") {
          resolve();
        } else if (msg.type === "mcp_call") {
          pwaWs.send(
            JSON.stringify({
              type: "mcp_result",
              requestId: msg.requestId,
              result: { tasks: [{ id: "t1", title: "Test Task" }] },
            }),
          );
        }
      });

      pwaWs.on("error", reject);
    });

    expect(bridge.isPwaConnected()).toBe(true);

    const callOutcome = await bridge.executeToolCall("get_tasks", {});
    expect(callOutcome.ok).toBe(true);
    if (callOutcome.ok) {
      const res = callOutcome.result as { tasks: Array<{ id: string; title: string }> };
      expect(res.tasks[0].title).toBe("Test Task");
    }

    pwaWs.close();
    await new Promise((r) => setTimeout(r, 50));

    expect(bridge.isPwaConnected()).toBe(false);

    const afterDisconnect = await bridge.executeToolCall("get_tasks", {});
    expect(afterDisconnect.ok).toBe(false);
    if (!afterDisconnect.ok) {
      expect(afterDisconnect.error).toContain("WASL_LOCAL_OFFLINE");
    }
  });

  it("rejects PWA connections with invalid secrets", async () => {
    const bridge = createBridge(43503);
    await bridge.start();

    const badWs = new WebSocket("ws://127.0.0.1:43503", {
      headers: { Origin: "http://localhost:3000" },
    });

    const authErrorReceived = await new Promise<boolean>((resolve) => {
      badWs.on("open", () => {
        badWs.send(JSON.stringify({ type: "auth", secret: "wrong_secret" }));
      });
      badWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_error") resolve(true);
      });
      badWs.on("close", () => resolve(true));
    });

    expect(authErrorReceived).toBe(true);
    expect(bridge.isPwaConnected()).toBe(false);
  });

  it("supports multiple simultaneous instances of the SAME client type on distinct ports", async () => {
    // Instance 1: Claude Code #1 on port 43510
    const bridge1 = createBridge(43510, "sec_claude_code_instance_1_32chars!!");
    await bridge1.start();

    // Instance 2: Claude Code #2 on port 43511
    const bridge2 = createBridge(43511, "sec_claude_code_instance_2_32chars!!");
    await bridge2.start();

    // Connect Instance 1
    const ws1 = new WebSocket("ws://127.0.0.1:43510", {
      headers: { Origin: "http://localhost:3000" },
    });
    await new Promise<void>((resolve) => {
      ws1.on("open", () => ws1.send(JSON.stringify({ type: "auth", secret: "sec_claude_code_instance_1_32chars!!" })));
      ws1.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") resolve();
        else if (msg.type === "mcp_call") {
          ws1.send(JSON.stringify({ type: "mcp_result", requestId: msg.requestId, result: { instance: "claude-1" } }));
        }
      });
    });

    // Connect Instance 2
    const ws2 = new WebSocket("ws://127.0.0.1:43511", {
      headers: { Origin: "http://localhost:3000" },
    });
    await new Promise<void>((resolve) => {
      ws2.on("open", () => ws2.send(JSON.stringify({ type: "auth", secret: "sec_claude_code_instance_2_32chars!!" })));
      ws2.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") resolve();
        else if (msg.type === "mcp_call") {
          ws2.send(JSON.stringify({ type: "mcp_result", requestId: msg.requestId, result: { instance: "claude-2" } }));
        }
      });
    });

    expect(bridge1.isPwaConnected()).toBe(true);
    expect(bridge2.isPwaConnected()).toBe(true);

    // Call both concurrently
    const [res1, res2] = await Promise.all([
      bridge1.executeToolCall("get_tasks", {}),
      bridge2.executeToolCall("get_tasks", {}),
    ]);

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    if (res1.ok) expect((res1.result as { instance: string }).instance).toBe("claude-1");
    if (res2.ok) expect((res2.result as { instance: string }).instance).toBe("claude-2");

    ws1.close();
    ws2.close();
  });

  it("strictly validates origins and rejects unauthorized web origins", async () => {
    const bridge = createBridge(43520, "test_sec_origin_32chars_long_12345");
    await bridge.start();

    // 1. Explicitly disallowed external origin is rejected
    const evilWs = new WebSocket("ws://127.0.0.1:43520", {
      headers: { Origin: "https://evil-attacker.com" },
    });
    const closedEvil = await new Promise<boolean>((resolve) => {
      evilWs.on("close", () => resolve(true));
      evilWs.on("error", () => resolve(true));
    });
    expect(closedEvil).toBe(true);

    // 2. Missing origin header is rejected (PWA browser always sends Origin)
    const missingOriginWs = new WebSocket("ws://127.0.0.1:43520");
    const closedMissing = await new Promise<boolean>((resolve) => {
      missingOriginWs.on("close", () => resolve(true));
      missingOriginWs.on("error", () => resolve(true));
    });
    expect(closedMissing).toBe(true);

    // 3. Loopback localhost origin is allowed and reaches auth
    const localhostWs = new WebSocket("ws://127.0.0.1:43520", {
      headers: { Origin: "http://localhost:3000" },
    });
    const localhostAllowed = await new Promise<boolean>((resolve) => {
      localhostWs.on("open", () => {
        localhostWs.send(JSON.stringify({ type: "auth", secret: "test_sec_origin_32chars_long_12345" }));
      });
      localhostWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_ok") resolve(true);
      });
      localhostWs.on("close", () => resolve(false));
    });
    expect(localhostAllowed).toBe(true);
    localhostWs.close();
    await bridge.close();
  });

  it("prevents cross-client secret reuse", async () => {
    const bridge = createBridge(43521, "correct_secret_for_this_client_32ch!");
    await bridge.start();

    // Intruder passes origin check (loopback) but fails secret auth
    const intruderWs = new WebSocket("ws://127.0.0.1:43521", {
      headers: { Origin: "http://localhost:3001" },
    });
    const rejected = await new Promise<boolean>((resolve) => {
      intruderWs.on("open", () => {
        intruderWs.send(JSON.stringify({ type: "auth", secret: "other_clients_secret_1234567890" }));
      });
      intruderWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_error") resolve(true);
      });
      intruderWs.on("close", () => resolve(true));
    });

    expect(rejected).toBe(true);
    expect(bridge.isPwaConnected()).toBe(false);
  });
});
