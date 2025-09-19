import type { CompletionLP, ModelInfo } from "@/types/logprob";
import type { Transport } from "@/types/transport";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export interface CompleteParams {
  readonly messages: readonly { readonly role: "user" | "assistant"; readonly content: string }[];
  readonly model: string;
  readonly temperature: number;
  readonly top_p: number;
  readonly presence_penalty: number;
  readonly frequency_penalty: number;
  readonly max_tokens: number; // 1–256
  readonly top_logprobs: number; // 1–10
  readonly force_prefix?: string;
  readonly continuation_mode?: "assistant-prefix" | "hint";
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status}: ${res.statusText}${detail ? ` - ${detail}` : ""}`,
    );
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

export class RestTransport implements Transport {
  complete(params: Readonly<CompleteParams>): Promise<CompletionLP> {
    return complete(params as CompleteParams);
  }
}
