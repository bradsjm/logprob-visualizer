export interface ConnectionSettings {
  apiKey: string;
  baseUrl: string;
}

export interface ProviderConnection {
  readonly settings: ConnectionSettings;
  readonly resolvedBaseUrl: string;
  readonly cacheKey: string;
  readonly hasSavedSettings: boolean;
}

export type ModelCapabilityStatus =
  | "idle"
  | "checking"
  | "supported"
  | "unsupported"
  | "unknown-transient";

export interface ModelCapability {
  status: ModelCapabilityStatus;
  message: string | null;
}
