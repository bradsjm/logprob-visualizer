export interface ConnectionSettings {
  apiKey: string;
  baseUrl: string;
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
