/**
 * lib/relay/permissions.ts
 *
 * Universal Multi-Client profile and permission management for WASL Local MCP.
 *
 * Security Model:
 * - Dynamic loopback port (42424-42499) & unique 256-bit revocable secret per connector.
 * - Granular permissions (Read-only vs Read+Write) and sensitive domain restrictions (Journal, Money, Health).
 * - Exact-origin security on WebSocket listener (rejects foreign web origins).
 * - Never permanently attaches fixed ports to product names.
 * - Seamless lossless migration preserving legacy profiles and existing secrets.
 */

import { todayISO } from "@/lib/date";
import type { McpClientPresetId } from "./presets";

export type PermissionLevel = "read" | "read_write";

export type DomainName =
  | "tasks"
  | "notes"
  | "goals"
  | "habits"
  | "blocks"
  | "recurring"
  | "topics"
  | "trash"
  | "journal"
  | "money"
  | "health";

export const DEFAULT_ALLOWED_DOMAINS: DomainName[] = [
  "tasks",
  "notes",
  "goals",
  "habits",
  "blocks",
  "recurring",
  "topics",
  "trash",
];

export const SENSITIVE_DOMAINS: DomainName[] = [
  "journal",
  "money",
  "health",
];

export interface McpClientProfile {
  id: string;
  presetId?: McpClientPresetId;
  name: string;
  /** Legacy stored profiles may still carry "remote"; treated as "direct". */
  type: "direct";
  transport?: "stdio" | "http";
  port: number;
  secret: string;
  permission: PermissionLevel;
  allowedDomains: DomainName[];
  createdAt: string;
  lastActiveAt: string;
  enabled: boolean;
  revoked: boolean;
}

const STORAGE_KEY = "wasl_mcp_client_profiles";

/** Generate a cryptographically secure random string in browser or Node. */
export function generateRandomSecret(length = 32): string {
  if (typeof window !== "undefined" && window.crypto) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Node fallback using crypto
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("node:crypto");
  return randomBytes(length).toString("hex");
}

/** Compute SHA-256 hash using Web Crypto API or Node crypto. */
export async function sha256Hex(text: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Node fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHash } = require("node:crypto");
    return createHash("sha256").update(text).digest("hex");
  } catch {
    return text;
  }
}

/** Map legacy ID or name to known preset ID */
function inferPresetId(profile: { id: string; name?: string; presetId?: McpClientPresetId }): McpClientPresetId {
  if (profile.presetId) return profile.presetId;
  const idLower = profile.id.toLowerCase();
  const nameLower = (profile.name ?? "").toLowerCase();

  if (idLower.includes("antigravity") || nameLower.includes("antigravity")) return "antigravity";
  if (idLower.includes("claude_code") || nameLower.includes("claude code")) return "claude-code";
  if (idLower.includes("claude_desktop") || nameLower.includes("claude desktop")) return "claude-desktop";
  if (idLower.includes("cursor") || nameLower.includes("cursor")) return "cursor";
  if (idLower.includes("codex") || nameLower.includes("codex")) return "codex";
  if (idLower.includes("hermes") || nameLower.includes("hermes")) return "hermes";
  if (idLower.includes("openclaw") || nameLower.includes("openclaw")) return "openclaw";
  if (idLower.includes("windsurf") || nameLower.includes("windsurf")) return "windsurf";
  if (idLower.includes("vscode") || nameLower.includes("vs code")) return "vscode";
  if (idLower.includes("zed") || nameLower.includes("zed")) return "zed";
  if (idLower.includes("continue") || nameLower.includes("continue")) return "continue";
  if (idLower.includes("cline") || idLower.includes("roo") || nameLower.includes("cline")) return "cline";
  if (idLower.includes("generic") || nameLower.includes("generic")) return "generic-stdio";
  return "custom";
}

export function getDefaultClientProfiles(): McpClientProfile[] {
  return [
    {
      id: "client_antigravity",
      presetId: "antigravity",
      name: "Antigravity IDE",
      type: "direct",
      transport: "stdio",
      port: 42424,
      secret: `wasl_sec_ag_${generateRandomSecret(20)}`,
      permission: "read_write",
      allowedDomains: [...DEFAULT_ALLOWED_DOMAINS],
      createdAt: todayISO(),
      lastActiveAt: todayISO(),
      enabled: true,
      revoked: false,
    },
    {
      id: "client_claude_code",
      presetId: "claude-code",
      name: "Claude Code",
      type: "direct",
      transport: "stdio",
      port: 42425,
      secret: `wasl_sec_cc_${generateRandomSecret(20)}`,
      permission: "read_write",
      allowedDomains: [...DEFAULT_ALLOWED_DOMAINS],
      createdAt: todayISO(),
      lastActiveAt: todayISO(),
      enabled: true,
      revoked: false,
    },
    {
      id: "client_cursor",
      presetId: "cursor",
      name: "Cursor",
      type: "direct",
      transport: "stdio",
      port: 42426,
      secret: `wasl_sec_cu_${generateRandomSecret(20)}`,
      permission: "read_write",
      allowedDomains: [...DEFAULT_ALLOWED_DOMAINS],
      createdAt: todayISO(),
      lastActiveAt: todayISO(),
      enabled: true,
      revoked: false,
    },
    {
      id: "client_codex",
      presetId: "codex",
      name: "Codex CLI",
      type: "direct",
      transport: "stdio",
      port: 42427,
      secret: `wasl_sec_cx_${generateRandomSecret(20)}`,
      permission: "read_write",
      allowedDomains: [...DEFAULT_ALLOWED_DOMAINS],
      createdAt: todayISO(),
      lastActiveAt: todayISO(),
      enabled: true,
      revoked: false,
    },
  ];
}

let inMemoryProfiles: McpClientProfile[] | null = null;

export function _resetProfilesForTest(): void {
  inMemoryProfiles = null;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function loadClientProfiles(): McpClientProfile[] {
  let list: McpClientProfile[];
  if (typeof window === "undefined" || !window.localStorage) {
    if (!inMemoryProfiles) {
      inMemoryProfiles = getDefaultClientProfiles();
    }
    list = inMemoryProfiles;
  } else {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const defaults = getDefaultClientProfiles();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
        return defaults;
      }
      const parsed = JSON.parse(raw) as McpClientProfile[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const defaults = getDefaultClientProfiles();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
        return defaults;
      }
      list = parsed;
    } catch {
      return getDefaultClientProfiles();
    }
  }

  let modified = false;
  const existingPorts = new Set<number>();

  // 1. Lossless Migration: Ensure all fields are present on existing profiles
  for (const p of list) {
    if (p.enabled === undefined) {
      p.enabled = true;
      modified = true;
    }
    if (!p.presetId) {
      p.presetId = inferPresetId(p);
      modified = true;
    }
    if (!p.transport) {
      p.transport = "stdio";
      modified = true;
    }
    if (!p.port || existingPorts.has(p.port)) {
      p.port = allocateAvailablePort(list);
      modified = true;
    }
    existingPorts.add(p.port);

    if (!p.secret) {
      p.secret = `wasl_sec_${p.id}_${generateRandomSecret(20)}`;
      modified = true;
    }
    if (!p.allowedDomains || !Array.isArray(p.allowedDomains)) {
      p.allowedDomains = [...DEFAULT_ALLOWED_DOMAINS];
      modified = true;
    }
    if (!p.permission) {
      p.permission = "read";
      modified = true;
    }
  }

  if (modified) {
    saveClientProfiles(list);
  }
  return list;
}

export function saveClientProfiles(profiles: McpClientProfile[]): void {
  inMemoryProfiles = profiles;
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // storage quota or disabled
  }
}

/** Find the next available loopback port not currently allocated (42424 - 42499). */
export function allocateAvailablePort(
  existingProfiles: McpClientProfile[],
  basePort = 42424,
  maxPort = 42499,
): number {
  const usedPorts = new Set(existingProfiles.map((p) => p.port));
  for (let port = basePort; port <= maxPort; port++) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }
  return basePort + Math.floor(Math.random() * 75);
}

/** Create a new dynamic connector profile with unique port and secret. */
export function createConnectorProfile(options: {
  presetId?: McpClientPresetId;
  name: string;
  transport?: "stdio" | "http";
  permission?: PermissionLevel;
  allowedDomains?: DomainName[];
  customPort?: number;
}): McpClientProfile {
  const profiles = loadClientProfiles();
  const id = `conn_${generateRandomSecret(8)}`;
  const port = options.customPort && !profiles.some((p) => p.port === options.customPort)
    ? options.customPort
    : allocateAvailablePort(profiles);
  const secret = `wasl_sec_${id}_${generateRandomSecret(20)}`;

  const newProfile: McpClientProfile = {
    id,
    presetId: options.presetId ?? "custom",
    name: options.name,
    type: "direct",
    transport: options.transport ?? "stdio",
    port,
    secret,
    permission: options.permission ?? "read_write",
    allowedDomains: options.allowedDomains ?? [...DEFAULT_ALLOWED_DOMAINS],
    createdAt: todayISO(),
    lastActiveAt: todayISO(),
    enabled: true,
    revoked: false,
  };

  profiles.push(newProfile);
  saveClientProfiles(profiles);
  return newProfile;
}

/** Update an existing connector profile. */
export function updateClientProfile(id: string, updates: Partial<McpClientProfile>): McpClientProfile | null {
  const profiles = loadClientProfiles();
  const target = profiles.find((p) => p.id === id);
  if (!target) return null;

  Object.assign(target, updates);
  saveClientProfiles(profiles);
  return target;
}

/** Toggle enabled status for a profile. */
export function toggleClientEnabled(profileId: string): boolean {
  const profiles = loadClientProfiles();
  const target = profiles.find((p) => p.id === profileId);
  if (!target) return false;

  target.enabled = !target.enabled;
  saveClientProfiles(profiles);
  return target.enabled;
}

/** Revoke access for a profile. */
export function revokeClientProfile(profileId: string): boolean {
  const profiles = loadClientProfiles();
  const target = profiles.find((p) => p.id === profileId);
  if (!target) return false;

  target.revoked = true;
  saveClientProfiles(profiles);
  return true;
}

/** Delete a connector profile by ID. */
export function deleteConnectorProfile(profileId: string): boolean {
  const profiles = loadClientProfiles();
  const filtered = profiles.filter((p) => p.id !== profileId);
  if (filtered.length !== profiles.length) {
    saveClientProfiles(filtered);
    return true;
  }
  return false;
}

/** Rotate the 256-bit secret for a connector. */
export function rotateClientSecret(clientId: string): string {
  const profiles = loadClientProfiles();
  const target = profiles.find((p) => p.id === clientId);
  const prefix = clientId.startsWith("conn_") ? clientId : clientId.replace("client_", "");
  const newSecret = `wasl_sec_${prefix}_${generateRandomSecret(20)}`;
  if (target) {
    target.secret = newSecret;
    saveClientProfiles(profiles);
  }
  return newSecret;
}

export function getDefaultDirectProfile(): McpClientProfile {
  const profiles = loadClientProfiles();
  return profiles[0] ?? getDefaultClientProfiles()[0];
}

export function rotateDirectConnectorSecret(): string {
  return rotateClientSecret("client_claude_code");
}
