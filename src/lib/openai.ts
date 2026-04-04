import { normalizeConnectionSettings, resolveBaseUrl } from "@/lib/connection";
import type { ConnectionSettings, ModelCapability } from "@/types/connection";
import type { CompletionLP, ModelInfo, TokenLP } from "@/types/logprob";
import type { CompleteParams } from "@/types/transport";

function buildHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function readErrorDetail(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}: ${response.statusText}`;

  try {
    const body = (await response.json()) as {
      error?: { message?: string };
      message?: string;
      detail?: string;
    };
    const detail =
      body.error?.message ?? body.message ?? body.detail ?? response.statusText;
    return `HTTP ${response.status}: ${detail}`;
  } catch {
    const detail = await response.text().catch(() => "");
    return detail ? `HTTP ${response.status}: ${detail}` : fallback;
  }
}

function resolveRequestBaseUrl(settings: Readonly<ConnectionSettings>): string {
  return resolveBaseUrl(normalizeConnectionSettings(settings).baseUrl);
}

export async function fetchProviderModels(
  settings: Readonly<ConnectionSettings>,
): Promise<ModelInfo[]> {
  const normalized = normalizeConnectionSettings(settings);
  const response = await fetch(`${resolveRequestBaseUrl(normalized)}/models`, {
    method: "GET",
    headers: buildHeaders(normalized.apiKey),
  });

  if (!response.ok) {
    throw new Error(await readErrorDetail(response));
  }

  const parsed = (await response.json()) as {
    data?: Array<{ id?: unknown }>;
  };

  if (!Array.isArray(parsed.data)) {
    throw new Error("Provider returned an invalid models response.");
  }

  const models = parsed.data.flatMap((item) => {
    if (!isObject(item) || typeof item.id !== "string" || item.id.length === 0) {
      return [];
    }

    return [
      {
        id: item.id,
        name: item.id,
      },
    ];
  });

  if (models.length === 0) {
    throw new Error("Provider returned an invalid models response.");
  }

  return models;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractDeltaText(delta: unknown): string {
  if (typeof delta === "string") {
    return delta;
  }

  if (Array.isArray(delta)) {
    return delta
      .map((part) => {
        if (!isObject(part)) return "";
        return typeof part.text === "string" ? part.text : "";
      })
      .join("");
  }

  if (isObject(delta) && typeof delta.content === "string") {
    return delta.content;
  }

  return "";
}

function isUsage(value: unknown): value is CompletionLP["usage"] {
  return (
    isObject(value) &&
    typeof value.prompt_tokens === "number" &&
    Number.isInteger(value.prompt_tokens) &&
    value.prompt_tokens >= 0 &&
    typeof value.completion_tokens === "number" &&
    Number.isInteger(value.completion_tokens) &&
    value.completion_tokens >= 0 &&
    typeof value.total_tokens === "number" &&
    Number.isInteger(value.total_tokens) &&
    value.total_tokens >= 0
  );
}

interface RawTopLogprob {
  token?: unknown;
  logprob?: unknown;
}

interface RawLogprobsItem {
  token?: unknown;
  logprob?: unknown;
  top_logprobs?: unknown;
}

export function normalizeLogprobsContent(
  raw: unknown,
  startIndex: number,
): TokenLP[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item, offset) => {
    if (!isObject(item)) {
      return [];
    }

    const token = typeof item.token === "string" ? item.token : "";
    const logprob =
      typeof item.logprob === "number" ? item.logprob : Number.NEGATIVE_INFINITY;
    const topLogprobs = Array.isArray((item as RawLogprobsItem).top_logprobs)
      ? ((item as RawLogprobsItem).top_logprobs as RawTopLogprob[]).flatMap(
          (alt) => {
            if (!isObject(alt)) {
              return [];
            }
            const altToken = typeof alt.token === "string" ? alt.token : "";
            const altLogprob =
              typeof alt.logprob === "number"
                ? alt.logprob
                : Number.NEGATIVE_INFINITY;
            return [
              {
                token: altToken,
                logprob: altLogprob,
                prob: Math.exp(altLogprob),
              },
            ];
          },
        )
      : [];

    return [
      {
        index: startIndex + offset,
        token,
        logprob,
        prob: Math.exp(logprob),
        top_logprobs: topLogprobs,
      },
    ];
  });
}

type StreamChunk = {
  model?: unknown;
  usage?: unknown;
  choices?: Array<{
    delta?: { content?: unknown };
    logprobs?: { content?: unknown };
    finish_reason?: unknown;
  }>;
};

function finalizeCompletion(
  _params: Readonly<CompleteParams>,
  startedAt: number,
  aggregatedText: string,
  tokens: readonly TokenLP[],
  model: string,
  finishReason: string,
  usage: CompletionLP["usage"] | null,
): CompletionLP {
  return {
    text: aggregatedText,
    tokens: [...tokens],
    finish_reason: finishReason || "stop",
    usage:
      usage ??
      {
        prompt_tokens: 0,
        completion_tokens: tokens.length,
        total_tokens: tokens.length,
      },
    model,
    latency: Date.now() - startedAt,
  };
}

export async function* parseOpenAIStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const decoder = new TextDecoder();
  let buffer = "";
  let eventLines: string[] = [];

  const flushEvent = function* (): Generator<string, void, unknown> {
    if (eventLines.length === 0) return;
    const data = eventLines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    eventLines = [];
    if (data) {
      yield data;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex !== -1) {
      const rawLine = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

      if (line === "") {
        yield* flushEvent();
      } else if (!line.startsWith(":")) {
        eventLines.push(line);
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  if (buffer.trim()) {
    eventLines.push(buffer.trim());
  }
  yield* flushEvent();
}

export async function probeModelLogprobsSupport(
  settings: Readonly<ConnectionSettings>,
  modelId: string,
): Promise<ModelCapability> {
  const normalized = normalizeConnectionSettings(settings);
  const response = await fetch(
    `${resolveRequestBaseUrl(normalized)}/chat/completions`,
    {
      method: "POST",
      headers: buildHeaders(normalized.apiKey),
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "." }],
        max_completion_tokens: 1,
        temperature: 0,
        logprobs: true,
        top_logprobs: 1,
        stream: false,
      }),
    },
  );

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    if (
      /logprob|top_logprobs|unsupported|not support|unknown parameter/i.test(
        detail,
      )
    ) {
      return {
        status: "unsupported",
        message: detail,
      };
    }
    return {
      status: "unknown",
      message: detail,
    };
  }

  const body = (await response.json()) as {
    choices?: Array<{
      logprobs?: { content?: unknown };
    }>;
  };
  const content = body.choices?.[0]?.logprobs?.content;
  if (!Array.isArray(content) || content.length === 0) {
    return {
      status: "unsupported",
      message: "Provider returned a completion without logprobs data.",
    };
  }

  return {
    status: "supported",
    message: null,
  };
}

export function consumeStreamChunk(
  _params: Readonly<CompleteParams>,
  _startedAt: number,
  state: {
    aggregatedText: string;
    tokens: TokenLP[];
    finishReason: string;
    usage: CompletionLP["usage"] | null;
    model: string;
  },
  chunk: StreamChunk,
): {
  deltaText: string;
  tokenEvents: TokenLP[];
  completion: CompletionLP | null;
} {
  if (typeof chunk.model === "string") {
    state.model = chunk.model;
  }

  if (isUsage(chunk.usage)) {
    state.usage = chunk.usage;
  }

  const choice = chunk.choices?.[0];
  const deltaText = extractDeltaText(choice?.delta?.content);
  if (deltaText) {
    state.aggregatedText += deltaText;
  }

  const tokenEvents = normalizeLogprobsContent(
    choice?.logprobs?.content,
    state.tokens.length,
  );
  if (tokenEvents.length > 0) {
    state.tokens.push(...tokenEvents);
  }

  if (typeof choice?.finish_reason === "string") {
    state.finishReason = choice.finish_reason;
  }

  return {
    deltaText,
    tokenEvents,
    completion: null,
  };
}

export function buildCompletionFromState(
  params: Readonly<CompleteParams>,
  startedAt: number,
  state: {
    aggregatedText: string;
    tokens: TokenLP[];
    finishReason: string;
    usage: CompletionLP["usage"] | null;
    model: string;
  },
): CompletionLP {
  return finalizeCompletion(
    params,
    startedAt,
    state.aggregatedText,
    state.tokens,
    state.model,
    state.finishReason,
    state.usage,
  );
}

export { readErrorDetail };
