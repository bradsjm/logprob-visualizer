import type { ConnectionSettings, ProviderConnection } from "@/types/connection";

export const CONNECTION_SETTINGS_STORAGE_KEY =
  "logprob-visualizer.connection.v1";

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

function normalizeStoredString(value: string): string {
  return value.trim();
}

export function normalizeConnectionSettings(
  settings: Readonly<ConnectionSettings>,
): ConnectionSettings {
  return {
    apiKey: normalizeStoredString(settings.apiKey),
    baseUrl: settings.baseUrl.trim().replace(/\/+$/, ""),
  };
}

export function resolveBaseUrl(baseUrl: string): string {
  return baseUrl.trim()
    ? normalizeConnectionSettings({ apiKey: "", baseUrl }).baseUrl
    : DEFAULT_OPENAI_BASE_URL;
}

export function validateBaseUrl(baseUrl: string): string | null {
  const normalized = normalizeConnectionSettings({
    apiKey: "",
    baseUrl,
  }).baseUrl;
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Base URL must use http or https.";
    }
    return null;
  } catch {
    return "Base URL must be a valid absolute URL.";
  }
}

export function readStoredConnectionSettings(): ConnectionSettings {
  if (typeof window === "undefined") {
    return { apiKey: "", baseUrl: "" };
  }

  const raw = window.localStorage.getItem(CONNECTION_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return { apiKey: "", baseUrl: "" };
  }

  try {
    const parsed = JSON.parse(raw) as {
      apiKey?: unknown;
      baseUrl?: unknown;
    };

    return normalizeConnectionSettings({
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
    });
  } catch {
    return { apiKey: "", baseUrl: "" };
  }
}

export function writeStoredConnectionSettings(
  settings: Readonly<ConnectionSettings>,
): ConnectionSettings {
  const normalized = normalizeConnectionSettings(settings);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      CONNECTION_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  }
  return normalized;
}

export function clearStoredConnectionSettings(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CONNECTION_SETTINGS_STORAGE_KEY);
  }
}

function buildConnectionCacheKey(settings: Readonly<ConnectionSettings>): string {
  const normalized = normalizeConnectionSettings(settings);
  if (!normalized.apiKey) {
    return `${resolveBaseUrl(normalized.baseUrl)}:anonymous`;
  }

  let hash = 0;
  for (const character of normalized.apiKey) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return `${resolveBaseUrl(normalized.baseUrl)}:${hash.toString(16)}`;
}

export function createProviderConnection(
  settings: Readonly<ConnectionSettings>,
): ProviderConnection {
  const normalizedSettings = normalizeConnectionSettings(settings);

  return {
    settings: normalizedSettings,
    resolvedBaseUrl: resolveBaseUrl(normalizedSettings.baseUrl),
    cacheKey: buildConnectionCacheKey(normalizedSettings),
    hasSavedSettings: normalizedSettings.apiKey.length > 0,
  };
}
