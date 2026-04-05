import { normalizeConnectionSettings, resolveBaseUrl } from "@/lib/connection";
import {
  buildCompletionFromState,
  consumeStreamChunk,
  extractStreamError,
  parseOpenAIStream,
  readErrorDetail,
} from "@/lib/openai";
import type { ConnectionSettings } from "@/types/connection";
import type {
  CompleteParams,
  Stream,
  StreamEvent,
  Transport,
} from "@/types/transport";

function buildBody(params: Readonly<CompleteParams>): CompleteParams {
  return {
    ...params,
    max_completion_tokens: Math.max(1, Math.min(256, params.max_completion_tokens)),
    top_logprobs: Math.max(1, Math.min(10, params.top_logprobs)),
  } satisfies CompleteParams;
}

/**
 * Implements the transport contract using direct browser streaming from a provider.
 */
export class StreamTransport implements Transport {
  constructor(private readonly settings: Readonly<ConnectionSettings>) {}

  complete(params: Readonly<CompleteParams>): Stream<StreamEvent> {
    const controller = new AbortController();
    const normalizedSettings = normalizeConnectionSettings(this.settings);
    const body = JSON.stringify({
      ...buildBody(params),
      logprobs: true,
      stream: true,
      stream_options: {
        include_usage: true,
      },
    });

    const execute = async function* () {
      const startedAt = Date.now();
      const res = await fetch(
        `${resolveBaseUrl(normalizedSettings.baseUrl)}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${normalizedSettings.apiKey}`,
            "Content-Type": "application/json",
          },
          body,
          signal: controller.signal,
        },
      );

      if (!res.ok || !res.body) {
        const detail = await readErrorDetail(res);
        yield {
          type: "done",
          error: detail,
        } as const;
        return;
      }

      const state = {
        aggregatedText: "",
        tokens: [],
        finishReason: "stop",
        usage: null,
        model: params.model,
      };

      try {
        for await (const data of parseOpenAIStream(res.body.getReader())) {
          if (data === "[DONE]") {
            break;
          }

          let chunk: unknown;
          try {
            chunk = JSON.parse(data);
          } catch {
            continue;
          }

          const streamError = extractStreamError(chunk);
          if (streamError) {
            yield {
              type: "done",
              error: streamError,
            } as const;
            return;
          }

          const { deltaText, tokenEvents } = consumeStreamChunk(
            params,
            startedAt,
            state,
            chunk as {
              model?: unknown;
              usage?: unknown;
              choices?: Array<{
                delta?: { content?: unknown };
                logprobs?: { content?: unknown };
                finish_reason?: unknown;
              }>;
            },
          );

          if (deltaText) {
            yield { type: "delta", delta: deltaText } as const;
          }

          for (const tokenEvent of tokenEvents) {
            yield { type: "logprobs", delta: tokenEvent } as const;
          }
        }

        yield {
          type: "done",
          completion: buildCompletionFromState(params, startedAt, state),
        } as const;
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          throw error;
        }
        yield {
          type: "done",
          error: (error as Error).message,
        } as const;
      }
    };

    const iterable: Stream<StreamEvent> = {
      abort: () => controller.abort(),
      [Symbol.asyncIterator]() {
        return execute();
      },
    };
    return iterable;
  }
}
