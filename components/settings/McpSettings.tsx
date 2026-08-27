"use client";
/**
 * components/settings/McpSettings.tsx
 *
 * Universal Connector-Profile Management System for WASL Local MCP.
 *
 * Architecture:
 * - Dynamic Connector Profiles: 13+ Presets + Custom Client (STDIO, HTTP).
 * - Dynamically allocated loopback ports from 42424-42499 (never hardcoded to product names).
 * - Multi-instance support: Run multiple connections of the same client concurrently.
 * - Granular per-connection permissions (Read vs Read+Write) and sensitive domain gating.
 * - Copy-ready configurations generated on the fly for every preset.
 * - Secret rotation, enable/disable toggles, revocation, and per-connection audit trails.
 * - Local MCP Audit Log section.
 */

import { useState, useMemo, useCallback } from "react";
import {
  Cpu,
  Lock,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Shield,
  Activity,
  Terminal,
  FileText,
  DollarSign,
  Heart,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Sparkles,
  Bot,
  Code,
  Code2,
  Zap,
  PlayCircle,
  SlidersHorizontal,
  Compass,
  Edit2,
  X,
  Search,
} from "lucide-react";
import { SettingsSection } from "./settings-ui";
import { useDataAdapter } from "@/lib/data/query/provider";
import {
  loadClientProfiles,
  createConnectorProfile,
  deleteConnectorProfile,
  rotateClientSecret,
  toggleClientEnabled,
  revokeClientProfile,
  updateClientProfile,
  allocateAvailablePort,
  type McpClientProfile,
  type DomainName,
} from "@/lib/relay/permissions";
import {
  MCP_PRESETS,
  PRESET_LIST,
  PRESET_CATEGORIES,
  type McpClientPresetId,
  type PresetCategory,
} from "@/lib/relay/presets";
import { loadAuditLog, type McpAuditEntry } from "@/lib/relay/audit";
import { LocalMcpExecutor } from "@/lib/relay/local-executor";
import { useMultiLoopbackSocket } from "@/lib/relay/use-loopback-socket";

// Map icon names to Lucide components
function getPresetIcon(iconName?: string, className = "h-4 w-4") {
  switch (iconName) {
    case "Sparkles":
      return <Sparkles className={className} />;
    case "Bot":
      return <Bot className={className} />;
    case "Terminal":
      return <Terminal className={className} />;
    case "Code":
      return <Code className={className} />;
    case "Code2":
      return <Code2 className={className} />;
    case "Zap":
      return <Zap className={className} />;
    case "PlayCircle":
      return <PlayCircle className={className} />;
    case "Compass":
      return <Compass className={className} />;
    case "SlidersHorizontal":
      return <SlidersHorizontal className={className} />;
    case "Shield":
      return <Shield className={className} />;
    default:
      return <Cpu className={className} />;
  }
}

export function McpSettings() {
  const adapter = useDataAdapter();

  // Direct Local MCP Master Toggle
  const [directEnabled, setDirectEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      return localStorage.getItem("wasl_mcp_direct_enabled") === "true";
    }
    return false;
  });

  // Client Profiles
  const [profiles, setProfiles] = useState<McpClientProfile[]>(() => loadClientProfiles());
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
    const list = loadClientProfiles();
    return list[0]?.id ?? "";
  });

  // Active Profile details
  const activeProfile = profiles.find((p) => p.id === selectedProfileId) ?? profiles[0];

  // UI state for secret and snippet copying
  const [showSecret, setShowSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeConfigTab, setActiveConfigTab] = useState<number>(0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");

  // "Add Connection" Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<McpClientPresetId>("antigravity");
  const [newConnName, setNewConnName] = useState("Antigravity IDE");
  const [newConnPermission, setNewConnPermission] = useState<"read" | "read_write">("read_write");
  const [newConnDomains] = useState<DomainName[]>([
    "tasks",
    "notes",
    "goals",
    "habits",
    "blocks",
    "recurring",
    "topics",
    "trash",
  ]);
  const [newConnTransport, setNewConnTransport] = useState<"stdio" | "http">("stdio");
  const [presetSearch, setPresetSearch] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<PresetCategory | "All">("All");

  // Audit Log state
  const [auditLogs, setAuditLogs] = useState<McpAuditEntry[]>(() => loadAuditLog());
  const [auditFilterProfileId, setAuditFilterProfileId] = useState<string | "all">("all");

  // Reload profiles helper
  const reloadProfiles = useCallback(() => {
    const fresh = loadClientProfiles();
    setProfiles(fresh);
    if (!fresh.some((p) => p.id === selectedProfileId) && fresh.length > 0) {
      setSelectedProfileId(fresh[0].id);
    }
  }, [selectedProfileId]);

  // Sync direct toggle
  const toggleDirect = (val: boolean) => {
    setDirectEnabled(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("wasl_mcp_direct_enabled", String(val));
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Executor instance
  const executor = useMemo(() => (adapter ? new LocalMcpExecutor(adapter) : null), [adapter]);

  // Multi-loopback socket hook
  const multiLoopback = useMultiLoopbackSocket({
    enabled: directEnabled,
    profiles,
    executor,
    onAuditLogUpdated: () => setAuditLogs(loadAuditLog()),
  });

  const activeClientState = activeProfile ? multiLoopback.clientStates[activeProfile.id] : null;

  // Select Profile handler
  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    setActiveConfigTab(0);
    setIsRenaming(false);
    const p = profiles.find((item) => item.id === id);
    if (p) {
      setRenameInput(p.name);
    }
  };

  // Handle Secret Rotation
  const handleRotateSecret = () => {
    if (!activeProfile) return;
    rotateClientSecret(activeProfile.id);
    reloadProfiles();
  };

  // Handle Enable/Disable Profile
  const handleToggleProfileEnabled = () => {
    if (!activeProfile) return;
    toggleClientEnabled(activeProfile.id);
    reloadProfiles();
  };

  // Handle Revoke Profile
  const handleRevokeProfile = () => {
    if (!activeProfile) return;
    revokeClientProfile(activeProfile.id);
    reloadProfiles();
  };

  // Handle Delete Profile
  const handleDeleteProfile = () => {
    if (!activeProfile) return;
    deleteConnectorProfile(activeProfile.id);
    reloadProfiles();
  };

  // Handle Rename Profile
  const handleSaveRename = () => {
    if (!activeProfile || !renameInput.trim()) return;
    updateClientProfile(activeProfile.id, { name: renameInput.trim() });
    setIsRenaming(false);
    reloadProfiles();
  };

  // Update Permission for Profile
  const handleUpdatePermission = (perm: "read" | "read_write") => {
    if (!activeProfile) return;
    updateClientProfile(activeProfile.id, { permission: perm });
    reloadProfiles();
  };

  // Toggle Domain Permission
  const handleToggleDomain = (domain: DomainName) => {
    if (!activeProfile) return;
    const current = activeProfile.allowedDomains ?? [];
    const next = current.includes(domain) ? current.filter((d) => d !== domain) : [...current, domain];
    updateClientProfile(activeProfile.id, { allowedDomains: next });
    reloadProfiles();
  };

  // Preset Selection in Modal
  const handleSelectPreset = (presetId: McpClientPresetId) => {
    setSelectedPresetId(presetId);
    const preset = MCP_PRESETS[presetId];
    if (preset) {
      setNewConnName(preset.name);
    }
  };

  // Create Connection from Modal
  const handleCreateConnection = () => {
    const newProfile = createConnectorProfile({
      presetId: selectedPresetId,
      name: newConnName.trim() || MCP_PRESETS[selectedPresetId]?.name || "New Connection",
      permission: newConnPermission,
      allowedDomains: newConnDomains,
      transport: newConnTransport,
    });
    setShowAddModal(false);
    reloadProfiles();
    setSelectedProfileId(newProfile.id);
  };

  // Filtered Presets for Modal
  const filteredPresets = useMemo(() => {
    return PRESET_LIST.filter((p) => {
      const matchesCat = activeCategoryFilter === "All" || p.category === activeCategoryFilter;
      const matchesSearch =
        p.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
        p.description.toLowerCase().includes(presetSearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [presetSearch, activeCategoryFilter]);

  // Generated configs for active profile
  const activePreset = activeProfile?.presetId ? MCP_PRESETS[activeProfile.presetId] : MCP_PRESETS["generic-stdio"];
  const configSnippets = useMemo(() => {
    if (!activeProfile || !activePreset) return [];
    return activePreset.generateConfigs({
      port: activeProfile.port,
      secret: activeProfile.secret,
      connectionName: activeProfile.name,
      transport: activeProfile.transport,
    });
  }, [activeProfile, activePreset]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    if (auditFilterProfileId === "all") return auditLogs;
    return auditLogs.filter((l) => l.clientId === auditFilterProfileId);
  }, [auditLogs, auditFilterProfileId]);

  return (
    <div className="space-y-4">
      <SettingsSection
        icon={<Cpu className="h-4 w-4" />}
        title="Local AI connections"
        description="Let AI apps on this machine (Antigravity, Claude Code, Cursor, Hermes, Codex…) work directly with your data over an authenticated loopback bridge."
        aside={
          <label className="relative inline-flex cursor-pointer items-center" aria-label="Enable local AI connections">
            <input
              type="checkbox"
              checked={directEnabled}
              onChange={(e) => toggleDirect(e.target.checked)}
              className="sr-only peer"
            />
            <div className="h-6 w-11 rounded-full bg-surface-2 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
          </label>
        }
      >
        {!directEnabled ? (
          <p className="rounded-[12px] bg-surface-2/50 px-3.5 py-3 text-[12.5px] leading-relaxed text-faint">
            Turn this on to create connections. Everything runs over <code className="font-mono">127.0.0.1</code> inside this
            browser window — close the window and connected AI apps safely lose access.
          </p>
        ) : (
            <div className="space-y-5">
              {/* Connections Bar: Selector & "Add Connection" Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  {profiles.map((profile) => {
                    const isSelected = profile.id === activeProfile?.id;
                    const cState = multiLoopback.clientStates[profile.id];
                    const isConnected = cState?.status === "connected";
                    const isRevoked = profile.revoked;
                    const isDisabled = !profile.enabled;

                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => handleSelectProfile(profile.id)}
                        className={`flex items-center gap-2 rounded-[8px] px-3 py-2 text-[12px] font-medium transition-all shrink-0 border ${
                          isSelected
                            ? "border-accent bg-accent/15 text-accent shadow-sm"
                            : "border-border/70 bg-surface-2/60 text-muted hover:text-text hover:bg-surface-2"
                        }`}
                      >
                        <span className="relative flex h-2 w-2">
                          {isConnected ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                            </>
                          ) : isRevoked ? (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
                          ) : isDisabled ? (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-muted"></span>
                          ) : (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-warn"></span>
                          )}
                        </span>
                        <span>{profile.name}</span>
                        <span className="font-mono text-[10px] text-faint">:{profile.port}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="btn-hero flex items-center justify-center gap-1.5 rounded-[8px] px-3.5 py-2 text-[12px] font-semibold shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Connection</span>
                </button>
              </div>

              {/* Active Connection Inspector Panel */}
              {activeProfile ? (
                <div className="space-y-5 rounded-[12px] border border-border/80 bg-surface-2/40 p-4 sm:p-5">
                  {/* Header: Name, Port, Status & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-[10px] bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                        {getPresetIcon(activePreset?.iconName, "h-5 w-5")}
                      </div>
                      <div>
                        {isRenaming ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={renameInput}
                              onChange={(e) => setRenameInput(e.target.value)}
                              className="rounded border border-accent bg-surface px-2 py-0.5 text-[13px] font-semibold text-text outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={handleSaveRename}
                              className="text-[11px] font-semibold text-accent px-1.5 py-0.5 rounded hover:bg-accent/10"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsRenaming(false);
                                setRenameInput(activeProfile.name);
                              }}
                              className="text-[11px] text-faint px-1.5 py-0.5 rounded hover:bg-surface-2"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h4 className="text-[14px] font-semibold text-text">{activeProfile.name}</h4>
                            <button
                              type="button"
                              onClick={() => setIsRenaming(true)}
                              className="text-faint hover:text-text p-0.5"
                              title="Rename connection"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <p className="text-[11px] text-faint">
                          {activePreset?.name ?? "Custom Profile"} • Loopback Port <code className="font-mono text-text">{activeProfile.port}</code>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Live Status Badge */}
                      <span className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border border-border bg-surface">
                        <span className="relative flex h-2 w-2">
                          {activeClientState?.status === "connected" ? (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                          ) : activeProfile.revoked ? (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
                          ) : !activeProfile.enabled ? (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-muted"></span>
                          ) : (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-warn"></span>
                          )}
                        </span>
                        <span className="font-medium text-text">
                          {activeProfile.revoked
                            ? "Revoked"
                            : !activeProfile.enabled
                              ? "Disabled"
                              : activeClientState?.status === "connected"
                                ? "Connected"
                                : `Listening (127.0.0.1:${activeProfile.port})`}
                        </span>
                      </span>

                      {/* Enable/Disable Button */}
                      <button
                        type="button"
                        onClick={handleToggleProfileEnabled}
                        disabled={activeProfile.revoked}
                        className="rounded-[6px] border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted hover:text-text transition-colors disabled:opacity-40"
                      >
                        {activeProfile.enabled ? "Disable" : "Enable"}
                      </button>

                      {/* Revoke Button */}
                      {!activeProfile.revoked && (
                        <button
                          type="button"
                          onClick={handleRevokeProfile}
                          className="rounded-[6px] bg-danger/10 border border-danger/20 px-2.5 py-1 text-[11px] font-medium text-danger hover:bg-danger/20 transition-colors"
                        >
                          Revoke
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={handleDeleteProfile}
                        className="text-faint hover:text-danger p-1 rounded transition-colors"
                        title="Delete connection"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Secret Display & Rotation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-medium text-text flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-accent" />
                        <span>Connector Secret (256-bit Cryptographic Key)</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleRotateSecret}
                        className="flex items-center gap-1 text-[11px] text-faint hover:text-text transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Rotate Secret</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center justify-between rounded-[8px] border border-border bg-surface px-3 py-2">
                        <span className="font-mono text-[12px] text-text select-all">
                          {showSecret ? activeProfile.secret : "••••••••••••••••••••••••••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          className="text-faint hover:text-text p-0.5 ml-2"
                        >
                          {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(activeProfile.secret, "secret")}
                        className="flex items-center gap-1.5 rounded-[8px] bg-accent/15 px-3 py-2 text-[12px] font-medium text-accent hover:bg-accent/25 transition-colors"
                      >
                        {copiedKey === "secret" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedKey === "secret" ? "Copied" : "Copy Secret"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Copy-Ready Configuration Snippets */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-medium text-text flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5 text-accent" />
                        <span>Configuration Snippet</span>
                      </label>
                      {configSnippets[activeConfigTab]?.filename && (
                        <span className="font-mono text-[10px] text-faint">
                          {configSnippets[activeConfigTab].filename}
                        </span>
                      )}
                    </div>

                    {/* Format Tabs (if multiple snippets) */}
                    {configSnippets.length > 1 && (
                      <div className="flex border-b border-border/50 gap-2">
                        {configSnippets.map((snip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveConfigTab(idx)}
                            className={`pb-1 text-[11px] font-medium transition-colors border-b-2 ${
                              activeConfigTab === idx
                                ? "border-accent text-accent"
                                : "border-transparent text-faint hover:text-text"
                            }`}
                          >
                            {snip.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Code Snippet Box */}
                    {configSnippets[activeConfigTab] && (
                      <div className="relative rounded-[8px] border border-border bg-surface p-3.5 font-mono text-[11px] text-text overflow-x-auto">
                        <pre className="whitespace-pre">{configSnippets[activeConfigTab].content}</pre>

                        <button
                          type="button"
                          onClick={() => copyToClipboard(configSnippets[activeConfigTab].content, "snippet")}
                          className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-[6px] bg-surface-2 px-2.5 py-1 text-[10px] font-medium text-faint hover:text-text border border-border shadow-sm"
                        >
                          {copiedKey === "snippet" ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedKey === "snippet" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    )}

                    {configSnippets[activeConfigTab]?.notes && (
                      <p className="text-[11px] text-faint italic leading-relaxed">
                        ℹ {configSnippets[activeConfigTab].notes}
                      </p>
                    )}
                  </div>

                  {/* Permissions & Sensitive Domains */}
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <h4 className="text-[13px] font-semibold text-text flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-accent" />
                      <span>{activeProfile.name} Access Permissions</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-start gap-2.5 rounded-[8px] border border-border/60 bg-surface p-3 cursor-pointer">
                        <input
                          type="radio"
                          name={`permission_${activeProfile.id}`}
                          checked={activeProfile.permission === "read"}
                          onChange={() => handleUpdatePermission("read")}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="text-[12px] font-semibold text-text block">Read-Only</span>
                          <span className="text-[11px] text-faint">AI can search and view data, but cannot create or modify entries.</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 rounded-[8px] border border-border/60 bg-surface p-3 cursor-pointer">
                        <input
                          type="radio"
                          name={`permission_${activeProfile.id}`}
                          checked={activeProfile.permission === "read_write"}
                          onChange={() => handleUpdatePermission("read_write")}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="text-[12px] font-semibold text-text block">Read & Write</span>
                          <span className="text-[11px] text-faint">AI can create, update, and manage tasks, notes, habits, and goals.</span>
                        </div>
                      </label>
                    </div>

                    {/* Sensitive Domains Opt-in */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-medium text-faint uppercase tracking-wider">
                        Sensitive Domains (Disabled by Default)
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { id: "journal" as DomainName, label: "Journal", icon: FileText },
                          { id: "money" as DomainName, label: "Money", icon: DollarSign },
                          { id: "health" as DomainName, label: "Health", icon: Heart },
                        ].map(({ id, label, icon: Icon }) => {
                          const enabled = activeProfile.allowedDomains?.includes(id) ?? false;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => handleToggleDomain(id)}
                              className={`flex items-center justify-between rounded-[8px] border p-2.5 text-[12px] transition-colors ${
                                enabled
                                  ? "border-accent/40 bg-accent/10 text-accent font-medium"
                                  : "border-border bg-surface text-faint hover:text-text"
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <Icon className="h-3.5 w-3.5" />
                                <span>{label}</span>
                              </div>
                              {enabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-faint text-[12px]">
                  No connection profiles found. Click &quot;Add Connection&quot; above to configure an AI client.
                </div>
              )}
            </div>
        )}
      </SettingsSection>

      {/* "Add Connection" Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card-glass w-full max-w-2xl space-y-5 p-6 border-border/80 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-accent" />
                <h3 className="font-display text-base font-semibold text-text">Add New MCP Connection</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-faint hover:text-text p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step 1: Preset Category Filter & Search */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                <label className="text-[12px] font-semibold text-text">Choose Client Preset</label>
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-faint" />
                  <input
                    type="text"
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                    placeholder="Search presets..."
                    className="w-full rounded-[6px] border border-border bg-surface-2 pl-8 pr-3 py-1.5 text-[12px] text-text outline-none"
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter("All")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    activeCategoryFilter === "All"
                      ? "bg-accent text-on-accent"
                      : "bg-surface-2 text-faint hover:text-text"
                  }`}
                >
                  All ({PRESET_LIST.length})
                </button>
                {PRESET_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategoryFilter(cat)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                      activeCategoryFilter === cat
                        ? "bg-accent text-on-accent"
                        : "bg-surface-2 text-faint hover:text-text"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Preset Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {filteredPresets.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`flex items-start gap-2.5 rounded-[8px] border p-3 text-left transition-all ${
                        isSelected
                          ? "border-accent bg-accent/15 text-text"
                          : "border-border bg-surface-2/60 text-faint hover:text-text hover:bg-surface-2"
                      }`}
                    >
                      <div className={`mt-0.5 rounded-[6px] p-1.5 ${isSelected ? "bg-accent/20 text-accent" : "bg-surface text-faint"}`}>
                        {getPresetIcon(preset.iconName, "h-4 w-4")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-semibold text-text truncate">{preset.name}</span>
                          <span className="text-[9px] uppercase tracking-wider text-faint px-1.5 py-0.5 rounded bg-surface border border-border/40">
                            {preset.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-faint line-clamp-2 mt-0.5">{preset.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Connection Details */}
            <div className="space-y-4 pt-2 border-t border-border/40">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-text">Connection Name</label>
                  <input
                    type="text"
                    value={newConnName}
                    onChange={(e) => setNewConnName(e.target.value)}
                    placeholder="e.g. Antigravity IDE, Cursor Personal"
                    className="w-full rounded-[8px] border border-border bg-surface-2 px-3 py-2 text-[12px] text-text outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-text">Assigned Loopback Port</label>
                  <div className="flex items-center h-[38px] rounded-[8px] border border-border bg-surface px-3 text-[12px] font-mono text-muted">
                    Auto-allocated: {allocateAvailablePort(profiles)}
                  </div>
                </div>
              </div>

              {/* Custom Transport Selector (if custom) */}
              {selectedPresetId === "custom" && (
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-text">Transport Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["stdio", "http"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewConnTransport(t)}
                        className={`rounded-[6px] border py-1.5 text-[11px] font-semibold uppercase ${
                          newConnTransport === t
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-border bg-surface-2 text-faint"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Default Permissions */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text">Access Permission</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 rounded-[8px] border border-border bg-surface-2 p-2.5 text-[12px] cursor-pointer">
                    <input
                      type="radio"
                      name="new_conn_perm"
                      checked={newConnPermission === "read"}
                      onChange={() => setNewConnPermission("read")}
                    />
                    <span>Read-Only</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-[8px] border border-border bg-surface-2 p-2.5 text-[12px] cursor-pointer">
                    <input
                      type="radio"
                      name="new_conn_perm"
                      checked={newConnPermission === "read_write"}
                      onChange={() => setNewConnPermission("read_write")}
                    />
                    <span>Read & Write</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-[8px] px-4 py-2 text-[12px] font-medium text-faint hover:text-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateConnection}
                className="btn-hero rounded-[8px] px-4 py-2 text-[12px] font-semibold"
              >
                Create Connection
              </button>
            </div>
          </div>
        </div>
      )}
      {auditLogs.length > 0 && (
      <SettingsSection
        icon={<Activity className="h-4 w-4" />}
        title="AI activity"
        description="Tool calls made by connected AI clients on this device."
        aside={
          <select
            value={auditFilterProfileId}
            onChange={(e) => setAuditFilterProfileId(e.target.value)}
            aria-label="Filter activity by client"
            className="rounded-[8px] border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text outline-none"
          >
            <option value="all">All clients ({auditLogs.length})</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        }
      >
            <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {filteredAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-[6px] border border-border/50 bg-surface-2/40 px-3 py-2 text-[11px]"
                >
                  <div className="flex items-center gap-2.5">
                    {log.outcome === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    ) : log.outcome === "denied" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-warn shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-danger shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text">{log.toolName}</span>
                        <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] text-faint border border-border/50 uppercase">
                          {log.domain}
                        </span>
                        <span className="text-faint">via {log.clientName}</span>
                      </div>
                      {log.errorMessage && (
                        <p className="text-[10px] text-danger/80 mt-0.5 line-clamp-1">{log.errorMessage}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-faint shrink-0">
                    <span className="font-mono text-[10px]">{log.durationMs}ms</span>
                    <span className="font-mono text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
      </SettingsSection>
      )}
    </div>
  );
}
