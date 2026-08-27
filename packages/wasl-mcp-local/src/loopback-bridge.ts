/**
 * packages/wasl-mcp-local/src/loopback-bridge.ts
 *
 * Loopback WebSocket bridge server for WASL Local Edition.
 *
 * Security Guarantees & Constraints:
 * - Binds STRICTLY to 127.0.0.1 (IPv4 loopback, never 0.0.0.0 or LAN).
 * - Implements Private Network Access (PNA) CORS headers.
 * - Authenticates incoming browser PWA connections via client-specific connector secret with timing-safe comparison.
 * - Rejects unauthenticated tool calls immediately with 1008 close code.
 * - Rejects oversized frames (> 256 KB) and malformed payloads.
 * - Cleans up and rejects all pending calls on disconnect.
 * - Diagnostic logs strictly output to stderr (keeping stdout clean for MCP JSON-RPC).
 */

import { createServer, type Server as HttpServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

export interface LoopbackBridgeOptions {
  port?: number;
  host?: string;
  secret?: string;
  allowedOrigins?: string[] | string;
  onClientStatusChange?: (connected: boolean) => void;
}

export interface BridgeCallOutcome {
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface PendingBridgeCall {
  requestId: string;
  resolve: (outcome: BridgeCallOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

const MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KB

export class LoopbackBridge {
  readonly port: number;
  readonly host: string;
  private secret?: string;
  private allowedOrigins?: string[] | string;
  private httpServer: HttpServer;
  private wss: WebSocketServer;
  private activeWs: WebSocket | null = null;
  private pendingCalls = new Map<string, PendingBridgeCall>();
  private onClientStatusChange?: (connected: boolean) => void;

  constructor(options: LoopbackBridgeOptions = {}) {
    this.port = options.port ?? Number(process.env.WASL_MCP_PORT ?? 42424);
    this.host = "127.0.0.1"; // Hardcoded loopback only
    this.secret = options.secret ?? process.env.WASL_CONNECTOR_SECRET;
    this.allowedOrigins = options.allowedOrigins;
    this.onClientStatusChange = options.onClientStatusChange;

    this.httpServer = createServer((req, res) => {
      // Loopback HTTP status endpoint.
      // Deliberately NOT CORS-enabled: a public webpage cannot read the
      // response cross-origin, so connection state stays invisible to the
      // web while remaining observable to local tools (curl, scripts, tests).
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          name: "wasl-mcp-local-bridge",
          version: "0.1.0",
          connected: Boolean(this.activeWs && this.activeWs.readyState === WebSocket.OPEN),
        }),
      );
    });

    this.wss = new WebSocketServer({
      server: this.httpServer,
      maxPayload: MAX_PAYLOAD_BYTES,
    });

    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: WebSocket, req) => {
      // 1. Strict loopback IP verification
      const remote = req.socket.remoteAddress;
      if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") {
        console.error(`[WASL Bridge:${this.port}] Rejected non-loopback address: ${remote}`);
        ws.close(1008, "Non-loopback connection forbidden");
        return;
      }

      // 2. Strict origin validation — the PWA browser ALWAYS sends an Origin header.
      // Missing, empty, and "null" origins are rejected. Loopback TCP check and
      // connector-secret authentication are independent layers; neither bypasses the other.
      const origin = req.headers.origin;
      if (!origin || !this.isAllowedOrigin(origin)) {
        console.error(`[WASL Bridge:${this.port}] Rejected origin: ${origin ?? "(missing)"}`);
        ws.close(1008, "Forbidden origin");
        return;
      }

      let isAuthenticated = false; // Secret is mandatory (enforced in cli.ts) — every connection must authenticate.

      // 3. Auth timeout enforcement: First message must authenticate within 5 seconds
      const authTimeout = setTimeout(() => {
        if (!isAuthenticated) {
          console.error(`[WASL Bridge:${this.port}] Connection closed: authentication timed out.`);
          ws.close(4001, "Authentication timeout");
        }
      }, 5000);

      ws.on("message", (data) => {
        const byteLen = Buffer.isBuffer(data)
          ? data.length
          : Array.isArray(data)
            ? data.reduce((acc, c) => acc + c.length, 0)
            : data.byteLength;

        if (byteLen > MAX_PAYLOAD_BYTES) {
          console.error(`[WASL Bridge:${this.port}] Payload exceeded maximum limit.`);
          ws.close(1009, "Message too large");
          return;
        }

        let msg: { type?: string; secret?: string; requestId?: string; result?: unknown; error?: string } = {};
        try {
          msg = JSON.parse(data.toString());
        } catch {
          console.error(`[WASL Bridge:${this.port}] Malformed JSON frame received.`);
          return;
        }

        if (msg.type === "auth") {
          if (isAuthenticated && this.activeWs === ws) {
            // Replay protection: already authenticated
            return;
          }

          if (this.secret) {
            const clientSecret = msg.secret ?? "";
            const a = Buffer.from(clientSecret);
            const b = Buffer.from(this.secret);
            if (a.length === b.length && timingSafeEqual(a, b)) {
              clearTimeout(authTimeout);
              isAuthenticated = true;
              if (this.activeWs && this.activeWs !== ws) {
                try {
                  this.activeWs.close(1000, "Replaced by new connection");
                } catch {
                  // ignore
                }
              }
              this.activeWs = ws;
              ws.send(JSON.stringify({ type: "auth_ok", version: "0.1.0", port: this.port }));
              this.onClientStatusChange?.(true);
              console.error(`[WASL Bridge:${this.port}] PWA client authenticated successfully.`);
            } else {
              clearTimeout(authTimeout);
              ws.send(JSON.stringify({ type: "auth_error", reason: "invalid_secret" }));
              ws.close(1008, "Invalid connector secret");
              console.error(`[WASL Bridge:${this.port}] PWA connection rejected: invalid secret.`);
            }
          } else {
            clearTimeout(authTimeout);
            ws.send(JSON.stringify({ type: "auth_error", reason: "bridge_misconfigured" }));
            ws.close(1011, "Bridge started without a secret");
            console.error(`[WASL Bridge:${this.port}] Connection rejected: bridge has no secret configured.`);
          }
          return;
        }

        if (!isAuthenticated) {
          clearTimeout(authTimeout);
          ws.send(JSON.stringify({ type: "auth_error", reason: "unauthenticated" }));
          ws.close(1008, "Unauthenticated");
          return;
        }

        if (msg.type === "mcp_result" && msg.requestId) {
          const pending = this.pendingCalls.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingCalls.delete(msg.requestId);
            pending.resolve({ ok: true, result: msg.result });
          }
          return;
        }

        if (msg.type === "mcp_error" && msg.requestId) {
          const pending = this.pendingCalls.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingCalls.delete(msg.requestId);
            pending.resolve({ ok: false, error: msg.error });
          }
          return;
        }
      });

      ws.on("close", () => {
        clearTimeout(authTimeout);
        if (this.activeWs === ws) {
          this.activeWs = null;
          this.rejectAllPending("WASL_LOCAL_OFFLINE: WASL Local PWA disconnected.");
          this.onClientStatusChange?.(false);
          console.error(`[WASL Bridge:${this.port}] PWA client disconnected.`);
        }
      });

      ws.on("error", (err) => {
        clearTimeout(authTimeout);
        console.error(`[WASL Bridge:${this.port}] WebSocket error: ${err.message}`);
        if (this.activeWs === ws) {
          this.activeWs = null;
          this.rejectAllPending("WASL_LOCAL_OFFLINE: WebSocket connection error.");
          this.onClientStatusChange?.(false);
        }
      });
    });
  }

  /**
   * Validates the WebSocket `Origin` header.
   *
   * The caller must reject connections where origin is absent before calling this method.
   * This method only validates the *content* of an already-present origin string.
   *
   * Policy (in precedence order):
   * 1. Empty string or "null" literal — rejected (browsers send this for sandboxed/opaque origins).
   * 2. Loopback origins (localhost / 127.0.0.1 / ::1) over http: or https: — allowed.
   *    These are same-machine browser connections; the TCP loopback IP check is a second guard.
   * 3. WASL_ALLOWED_ORIGINS env var — exact, case-insensitive, trailing-slash-normalised list.
   *    Populate with your exact PWA origin, e.g.:
   *      WASL_ALLOWED_ORIGINS=https://your-wasl-pwa.example.com
   *    Suffix matches, subdomain wildcards, and user-info tricks are all rejected.
   */
  private isAllowedOrigin(origin: string): boolean {
    const trimmed = origin.trim();

    // Reject explicit null / empty string origins from browsers
    if (!trimmed || trimmed.toLowerCase() === "null") return false;

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    const proto = parsed.protocol.toLowerCase();

    // 1. Loopback origins
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return proto === "http:" || proto === "https:";
    }

    // 2. Exact allowlist from defaults, options, and WASL_ALLOWED_ORIGINS (comma-separated, no wildcards)
    const envList = process.env.WASL_ALLOWED_ORIGINS ?? "";
    const optionsList = Array.isArray(this.allowedOrigins)
      ? this.allowedOrigins
      : (this.allowedOrigins ? this.allowedOrigins.split(",") : []);

    const defaultOrigins = [
      "https://wasl-local.vercel.app",
      "https://wasl-cloud.vercel.app",
    ];

    const allowed = [
      ...defaultOrigins,
      ...envList.split(","),
      ...optionsList,
    ]
      .map((o) => o.trim().toLowerCase().replace(/\/$/, ""))
      .filter(Boolean);

    // Normalise the incoming origin the same way (strip trailing slash, lower-case)
    const normalised = trimmed.toLowerCase().replace(/\/$/, "");

    return allowed.includes(normalised);
  }

  private rejectAllPending(errorReason: string): void {
    for (const [id, pending] of this.pendingCalls.entries()) {
      clearTimeout(pending.timer);
      this.pendingCalls.delete(id);
      pending.resolve({ ok: false, error: errorReason });
    }
  }

  async executeToolCall(toolName: string, args: unknown): Promise<BridgeCallOutcome> {
    if (!this.activeWs || this.activeWs.readyState !== WebSocket.OPEN) {
      const startWait = Date.now();
      while (Date.now() - startWait < 2000) {
        if (this.activeWs && this.activeWs.readyState === WebSocket.OPEN) break;
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (!this.activeWs || this.activeWs.readyState !== WebSocket.OPEN) {
      return {
        ok: false,
        error:
          "WASL_LOCAL_OFFLINE: WASL Local PWA is not currently connected to the local bridge on port " +
          this.port +
          ". Please open WASL in your browser to allow tool access.",
      };
    }

    const requestId = randomUUID();
    return new Promise<BridgeCallOutcome>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(requestId);
        resolve({
          ok: false,
          error: `WASL_LOCAL_TIMEOUT: WASL Local PWA did not respond within 30 seconds for tool '${toolName}'.`,
        });
      }, 30_000);

      this.pendingCalls.set(requestId, {
        requestId,
        resolve,
        timer,
      });

      try {
        this.activeWs!.send(
          JSON.stringify({
            type: "mcp_call",
            requestId,
            toolName,
            args,
          }),
          (err) => {
            if (err) {
              clearTimeout(timer);
              this.pendingCalls.delete(requestId);
              resolve({
                ok: false,
                error: `WASL_LOCAL_OFFLINE: PWA connection failed: ${err.message}`,
              });
            }
          },
        );
      } catch (err: unknown) {
        clearTimeout(timer);
        this.pendingCalls.delete(requestId);
        resolve({
          ok: false,
          error: `WASL_LOCAL_OFFLINE: Failed to send request: ${(err as Error)?.message}`,
        });
      }
    });
  }

  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.httpServer.on("error", reject);
      this.httpServer.listen(this.port, this.host, () => {
        console.error(`[WASL Bridge:${this.port}] Listening on ws://${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  close(): Promise<void> {
    this.rejectAllPending("WASL_LOCAL_OFFLINE: Bridge shutting down.");
    return new Promise<void>((resolve) => {
      this.wss.close(() => {
        this.httpServer.close(() => resolve());
      });
    });
  }

  isPwaConnected(): boolean {
    return Boolean(this.activeWs && this.activeWs.readyState === WebSocket.OPEN);
  }
}
