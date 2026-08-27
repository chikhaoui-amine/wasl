"use client";

import { Hydrate } from "@/lib/hydration";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default function SettingsRoute() {
  return (
    <Hydrate>
      <SettingsPage />
    </Hydrate>
  );
}
