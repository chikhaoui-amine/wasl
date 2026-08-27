"use client";
/**
 * lib/relay/use-loopback-socket.ts
 *
 * Multi-Client React hook for WASL Local PWA to maintain authenticated loopback
 * connections to all configured local Direct MCP bridges (Claude Code, Cursor, Codex, etc.).
 *
 * Architecture & Guarantees:
 * - One WebSocket connection per enabled client port.
 * - Authenticates with that client's specific secret.
 * - Evaluates incoming calls with that client's specific permissions.
 * - Automatic background reconnect for every active client.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { McpClientProfile } from "./permissions";
import type { McpCallPayload, LocalMcpExecutor } from "./local-executor";

export type LoopbackStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "closed";

export interface ClientConnectionState {
  clientId: string;
  port: number;
  status: LoopbackStatus;
  error: string | null;
}

export interface MultiLoopbackHookOptions {
  enabled: boolean;
  profiles: McpClientProfile[];
  executor: LocalMcpExecutor | null;
  onAuditLogUpdated?: () => void;
}

export interface MultiLoopbackHookResult {
  clientStates: Record<string, ClientConnectionState>;
  overallStatus: LoopbackStatus;
  reconnectAll: () => void;
}

export function useMultiLoopbackSocket({
  enabled,
  profiles,
  executor,
  onAuditLogUpdated,
}: MultiLoopbackHookOptions): MultiLoopbackHookResult {
  const [clientStates, setClientStates] = useState<Record<string, ClientConnectionState>>({});

  const socketsRef = useRef<Map<string, WebSocket>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const mountedRef = useRef(true);
  const latestExecutorRef = useRef(executor);
  const latestProfilesRef = useRef(profiles);
  const onAuditLogUpdatedRef = useRef(onAuditLogUpdated);

  useEffect(() => {
    latestExecutorRef.current = executor;
  }, [executor]);

  useEffect(() => {
    latestProfilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    onAuditLogUpdatedRef.current = onAuditLogUpdated;
  }, [onAuditLogUpdated]);

  const clearTimer = useCallback((clientId: string) => {
    const t = timersRef.current.get(clientId);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(clientId);
    }
  }, []);

  const closeSocket = useCallback((clientId: string) => {
    const ws = socketsRef.current.get(clientId);
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      try {
        ws.close();
      } catch {
        // ignore
      }
      socketsRef.current.delete(clientId);
    }
  }, []);

  const connectClientRef = useRef<(profile: McpClientProfile) => void>(() => {});

  const connectClient = useCallback(
    (profile: McpClientProfile) => {
      if (!mountedRef.current || !enabled || profile.revoked || profile.enabled === false) {
        closeSocket(profile.id);
        clearTimer(profile.id);
        return;
      }

      const clientId = profile.id;
      closeSocket(clientId);
      clearTimer(clientId);

      const wsUrl = `ws://127.0.0.1:${profile.port}`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
        socketsRef.current.set(clientId, ws);
      } catch {
        const t = setTimeout(() => {
          if (!mountedRef.current) return;
          setClientStates((prev) => ({
            ...prev,
            [clientId]: {
              clientId,
              port: profile.port,
              status: "error",
              error: `Cannot connect to loopback bridge at ${wsUrl}`,
            },
          }));
          connectClientRef.current(profile);
        }, 1000);
        timersRef.current.set(clientId, t);
        return;
      }

      ws.onopen = () => {
        if (!mountedRef.current) return;
        ws.send(JSON.stringify({ type: "auth", secret: profile.secret }));
      };

      ws.onmessage = async (event) => {
        if (!mountedRef.current) return;
        let msg: { type?: string; reason?: string; requestId?: string; toolName?: string; args?: Record<string, unknown> } = {};
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === "auth_ok") {
          setClientStates((prev) => ({
            ...prev,
            [clientId]: {
              clientId,
              port: profile.port,
              status: "connected",
              error: null,
            },
          }));
          return;
        }

        if (msg.type === "auth_error") {
          setClientStates((prev) => ({
            ...prev,
            [clientId]: {
              clientId,
              port: profile.port,
              status: "error",
              error: `Authentication failed: ${msg.reason ?? "Invalid secret"}`,
            },
          }));
          return;
        }

        if (msg.type === "mcp_call" && msg.requestId && msg.toolName) {
          const { requestId, toolName, args } = msg;
          const currentExec = latestExecutorRef.current;
          const currentProfile = latestProfilesRef.current.find((p) => p.id === clientId) ?? profile;

          if (!currentExec) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "mcp_error",
                  requestId,
                  error: "WASL DataAdapter is not initialized.",
                }),
              );
            }
            return;
          }

          const callPayload: McpCallPayload = { requestId, toolName, args };
          const outcome = await currentExec.execute(callPayload, currentProfile);
          onAuditLogUpdatedRef.current?.();

          if (ws.readyState === WebSocket.OPEN) {
            if (outcome.ok) {
              ws.send(JSON.stringify({ type: "mcp_result", requestId, result: outcome.result }));
            } else {
              ws.send(JSON.stringify({ type: "mcp_error", requestId, error: outcome.error }));
            }
          }
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setClientStates((prev) => ({
          ...prev,
          [clientId]: {
            clientId,
            port: profile.port,
            status: "reconnecting",
            error: null,
          },
        }));
        const t = setTimeout(() => connectClientRef.current(profile), 1000);
        timersRef.current.set(clientId, t);
      };

      ws.onerror = () => {
        // ws.onclose will fire after onerror
      };
    },
    [enabled, closeSocket, clearTimer],
  );

  useEffect(() => {
    connectClientRef.current = connectClient;
  }, [connectClient]);

  const reconnectAll = useCallback(() => {
    if (!enabled) return;
    for (const p of profiles) {
      if (!p.revoked && p.enabled !== false) {
        connectClient(p);
      } else {
        closeSocket(p.id);
        clearTimer(p.id);
      }
    }
  }, [enabled, profiles, connectClient, closeSocket, clearTimer]);

  useEffect(() => {
    mountedRef.current = true;

    const handleUnload = () => {
      for (const p of profiles) {
        closeSocket(p.id);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleUnload);
      window.addEventListener("pagehide", handleUnload);
    }

    if (enabled) {
      for (const p of profiles) {
        if (!p.revoked && p.enabled !== false) {
          connectClient(p);
        } else {
          closeSocket(p.id);
          clearTimer(p.id);
        }
      }
    } else {
      for (const p of profiles) {
        closeSocket(p.id);
        clearTimer(p.id);
      }
      queueMicrotask(() => {
        if (mountedRef.current) {
          setClientStates({});
        }
      });
    }

    return () => {
      mountedRef.current = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", handleUnload);
        window.removeEventListener("pagehide", handleUnload);
      }
      for (const p of profiles) {
        closeSocket(p.id);
        clearTimer(p.id);
      }
    };
  }, [enabled, profiles, connectClient, closeSocket, clearTimer]);

  // Derive overall status
  const states = Object.values(clientStates);
  const anyConnected = states.some((s) => s.status === "connected");
  const anyConnecting = states.some((s) => s.status === "connecting" || s.status === "reconnecting");
  const overallStatus: LoopbackStatus = !enabled
    ? "idle"
    : anyConnected
      ? "connected"
      : anyConnecting
        ? "connecting"
        : "idle";

  return {
    clientStates,
    overallStatus,
    reconnectAll,
  };
}

// Single-client compatibility hook
export function useLoopbackSocket(options: {
  enabled: boolean;
  secret: string;
  port?: number;
  executor: (call: { requestId: string; toolName: string; args?: Record<string, unknown> }) => Promise<unknown>;
}) {
  const [status, setStatus] = useState<LoopbackStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const latestExecutorRef = useRef(options.executor);
  const latestSecretRef = useRef(options.secret);
  const connectFnRef = useRef<() => void>(() => {});

  useEffect(() => {
    latestExecutorRef.current = options.executor;
  }, [options.executor]);

  useEffect(() => {
    latestSecretRef.current = options.secret;
  }, [options.secret]);

  const clearTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  }, []);

  const doConnect = useCallback(() => {
    if (!mountedRef.current) return;
    closeWs();
    clearTimer();

    const wsUrl = `ws://127.0.0.1:${options.port ?? 42424}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch {
      setTimeout(() => {
        if (!mountedRef.current) return;
        setStatus("error");
        setError(`Cannot connect to loopback bridge at ${wsUrl}`);
      }, 0);
      reconnectTimerRef.current = setTimeout(() => connectFnRef.current(), 5000);
      return;
    }

    ws.onopen = () => {
      if (!mountedRef.current) return;
      ws.send(JSON.stringify({ type: "auth", secret: latestSecretRef.current }));
    };

    ws.onmessage = async (event) => {
      if (!mountedRef.current) return;
      let msg: { type?: string; reason?: string; requestId?: string; toolName?: string; args?: Record<string, unknown> } = {};
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "auth_ok") {
        setStatus("connected");
        setError(null);
        return;
      }

      if (msg.type === "auth_error") {
        setStatus("error");
        setError(`Authentication failed: ${msg.reason ?? "Invalid secret"}`);
        return;
      }

      if (msg.type === "mcp_call" && msg.requestId && msg.toolName) {
        const { requestId, toolName, args } = msg;
        try {
          const result = await latestExecutorRef.current({ requestId, toolName, args });
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "mcp_result", requestId, result }));
          }
        } catch (err: unknown) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "mcp_error",
                requestId,
                error: (err as Error)?.message ?? "Execution failed",
              }),
            );
          }
        }
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus("reconnecting");
      reconnectTimerRef.current = setTimeout(() => connectFnRef.current(), 3000);
    };

    ws.onerror = () => {
      // ws.onclose will handle
    };
  }, [options.port, closeWs, clearTimer]);

  useEffect(() => {
    connectFnRef.current = doConnect;
  }, [doConnect]);

  useEffect(() => {
    mountedRef.current = true;
    if (options.enabled) {
      doConnect();
    } else {
      closeWs();
      clearTimer();
    }

    return () => {
      mountedRef.current = false;
      closeWs();
      clearTimer();
    };
  }, [options.enabled, doConnect, closeWs, clearTimer]);

  return {
    status: options.enabled ? status : "idle",
    error,
    reconnect: doConnect,
  };
}
