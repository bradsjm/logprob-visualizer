import type { CompletionLP, ModelInfo } from "@/types/logprob";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export interface CompleteParams {
  messages: { role: "user" | "assistant"; content: string }[];
  model: string;
  temperature: number;
  top_p: number;
  presence_penalty: number;
  frequency_penalty: number;
  max_tokens: number; // 1–256
  top_logprobs: number; // 1–10
  force_prefix?: string;
  continuation_mode?: "assistant-prefix" | "hint";
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${res.statusText}${detail ? ` - ${detail}` : ""}`);
  }
  return (await res.json()) as T;
}

export async function getModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${API_BASE}/models`, { method: "GET" });
  return json<ModelInfo[]>(res);
}

export async function complete(params: CompleteParams): Promise<CompletionLP> {
  // Client-side clamping (server will clamp again)
  const body = {
    ...params,
    max_tokens: Math.max(1, Math.min(256, params.max_tokens)),
    top_logprobs: Math.max(1, Math.min(10, params.top_logprobs)),
  } satisfies CompleteParams;

  const res = await fetch(`${API_BASE}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return json<CompletionLP>(res);
}
