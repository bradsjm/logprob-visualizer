import { useState } from "react";

import {
  clearStoredConnectionSettings,
  hasConnectionSettings,
  readStoredConnectionSettings,
  resolveBaseUrl,
  writeStoredConnectionSettings,
} from "@/lib/connection";
import type { ConnectionSettings } from "@/types/connection";

export interface UseConnectionSettingsResult {
  settings: ConnectionSettings;
  resolvedBaseUrl: string;
  hasSavedSettings: boolean;
  saveSettings: (next: Readonly<ConnectionSettings>) => void;
  clearSettings: () => void;
}

export function useConnectionSettings(): UseConnectionSettingsResult {
  const [settings, setSettings] = useState<ConnectionSettings>(() =>
    readStoredConnectionSettings(),
  );

  const saveSettings = (next: Readonly<ConnectionSettings>): void => {
    setSettings(writeStoredConnectionSettings(next));
  };

  const clearSettings = (): void => {
    clearStoredConnectionSettings();
    setSettings({ apiKey: "", baseUrl: "" });
  };

  return {
    settings,
    resolvedBaseUrl: resolveBaseUrl(settings.baseUrl),
    hasSavedSettings: hasConnectionSettings(settings),
    saveSettings,
    clearSettings,
  };
}
