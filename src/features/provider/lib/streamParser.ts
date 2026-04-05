import type { CompletionLP, TokenLP } from "@/types/logprob";
import type { CompleteParams } from "@/types/transport";

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

type StreamChunk = {
  model?: unknown;
  usage?: unknown;
  choices?: Array<{
    delta?: { content?: unknown };
    logprobs?: { content?: unknown };
    finish_reason?: unknown;
  }>;
};

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

export async function* parseServerSentEvents(
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
    if (done) {
      buffer += decoder.decode();
      break;
    }

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

function finalizeCompletion(
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
    usage,
    model,
    latency: Date.now() - startedAt,
  };
}

export function extractStreamError(chunk: unknown): string | null {
  if (!isObject(chunk)) {
    return null;
  }

  if (
    isObject(chunk.error) &&
    typeof chunk.error.message === "string" &&
    chunk.error.message.trim().length > 0
  ) {
    return chunk.error.message;
  }

  if (typeof chunk.message === "string" && chunk.message.trim().length > 0) {
    return chunk.message;
  }

  if (typeof chunk.detail === "string" && chunk.detail.trim().length > 0) {
    return chunk.detail;
  }

  return null;
}

export interface CompletionAssemblyState {
  aggregatedText: string;
  tokens: TokenLP[];
  finishReason: string;
  usage: CompletionLP["usage"] | null;
  model: string;
}

export function consumeStreamChunk(
  state: CompletionAssemblyState,
  chunk: StreamChunk,
): {
  deltaText: string;
  tokenEvents: TokenLP[];
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
  };
}

export function buildCompletionFromState(
  _params: Readonly<CompleteParams>,
  startedAt: number,
  state: CompletionAssemblyState,
): CompletionLP {
  return finalizeCompletion(
    startedAt,
    state.aggregatedText,
    state.tokens,
    state.model,
    state.finishReason,
    state.usage,
  );
}
