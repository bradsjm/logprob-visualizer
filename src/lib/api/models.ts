import { API_BASE, parseJsonResponse } from "@/lib/api/client";
import type { ModelInfo } from "@/types/logprob";

export async function getModels(): Promise<ModelInfo[]> {
  const response = await fetch(`${API_BASE}/models`, { method: "GET" });
  return parseJsonResponse<ModelInfo[]>(response);
}
