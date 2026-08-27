"use client";

import { useState } from "react";
import { useDataAdapter } from "@/lib/data/query/provider";
import { EditionBadge, SettingsTabs } from "./settings-ui";
import {
  StorageSection,
  LegacyMigrationSection,
  DangerZoneSection,
  AboutWaslSection,
} from "./LocalStorageSettings";
import { McpSettings } from "./McpSettings";
import { DataPortabilitySection } from "./DataPortabilitySection";

type Tab = "general" | "data" | "ai";

export function SettingsPage() {
  const adapter = useDataAdapter();
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      const t = search.get("tab");
      if (t === "ai" || t === "data" || t === "general") return t as Tab;
      if (window.location.hash === "#ai") return "ai";
      if (window.location.hash === "#data") return "data";
    }
    return "general";
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "data", label: "Backup & transfer" },
    { id: "ai", label: "AI connections" },
  ];

  return (
    <div className="space-y-4">
      <EditionBadge />
      <SettingsTabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="space-y-4 pb-10">
        {tab === "general" && (
          <>
            <AboutWaslSection />
            <StorageSection />
            <DangerZoneSection />
          </>
        )}
        {tab === "data" && (
          <>
            {adapter && <DataPortabilitySection adapter={adapter} titlePrefix="Local" />}
            <LegacyMigrationSection />
          </>
        )}
        {tab === "ai" && <McpSettings />}
      </div>
    </div>
  );
}
