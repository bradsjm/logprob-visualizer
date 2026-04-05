import { useMemo, useState } from "react";

import {
  clearStoredConnectionSettings,
  createProviderConnection,
  readStoredConnectionSettings,
  writeStoredConnectionSettings,
} from "@/lib/connection";
import type { ConnectionSettings, ProviderConnection } from "@/types/connection";

export interface UseConnectionSettingsResult {
  readonly settings: ConnectionSettings;
  readonly connection: ProviderConnection;
  readonly resolvedBaseUrl: string;
  readonly hasSavedSettings: boolean;
  readonly saveSettings: (next: Readonly<ConnectionSettings>) => void;
  readonly clearSettings: () => void;
}

export function useConnectionSettings(): UseConnectionSettingsResult {
  const [settings, setSettings] = useState<ConnectionSettings>(() =>
    readStoredConnectionSettings(),
  );
  const connection = useMemo(() => createProviderConnection(settings), [settings]);

  const saveSettings = (next: Readonly<ConnectionSettings>): void => {
    setSettings(writeStoredConnectionSettings(next));
  };

  const clearSettings = (): void => {
    clearStoredConnectionSettings();
    setSettings({ apiKey: "", baseUrl: "" });
  };

  return {
    settings,
    connection,
    resolvedBaseUrl: connection.resolvedBaseUrl,
    hasSavedSettings: connection.hasSavedSettings,
    saveSettings,
    clearSettings,
  };
}
