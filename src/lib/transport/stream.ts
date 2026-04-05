import { sanitizeRunParameters } from "@/features/playground/lib/runParameters";
import { readErrorDetail } from "@/features/provider/lib/client";
import {
  buildCompletionFromState,
  consumeStreamChunk,
  extractStreamError,
  parseServerSentEvents,
} from "@/features/provider/lib/streamParser";
import { createProviderConnection } from "@/lib/connection";
import type { ConnectionSettings, ProviderConnection } from "@/types/connection";
import type {
  CompleteParams,
  Stream,
  StreamEvent,
  Transport,
} from "@/types/transport";

function buildBody(params: Readonly<CompleteParams>): CompleteParams {
  const sanitizedParameters = sanitizeRunParameters(params);

  return {
    ...params,
    ...sanitizedParameters,
  } satisfies CompleteParams;
}

/**
 * Implements the transport contract using direct browser streaming from a provider.
 */
export class StreamTransport implements Transport {
  private readonly connection: ProviderConnection;

  constructor(connection: Readonly<ProviderConnection> | Readonly<ConnectionSettings>) {
    this.connection =
      "resolvedBaseUrl" in connection
        ? connection
        : createProviderConnection(connection);
  }

  complete(params: Readonly<CompleteParams>): Stream<StreamEvent> {
    const controller = new AbortController();
    const connection = this.connection;
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
        `${connection.resolvedBaseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${connection.settings.apiKey}`,
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
        for await (const data of parseServerSentEvents(res.body.getReader())) {
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
