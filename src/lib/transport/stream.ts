import { API_BASE } from "@/lib/api/client";
import type { CompleteParams, Stream, StreamEvent, Transport } from "@/types/transport";

function buildBody(params: Readonly<CompleteParams>): CompleteParams {
  return {
    ...params,
    max_tokens: Math.max(1, Math.min(256, params.max_tokens)),
    top_logprobs: Math.max(1, Math.min(10, params.top_logprobs)),
  } satisfies CompleteParams;
}

async function* parseNdjson(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<StreamEvent, void, unknown> {
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        const evt = JSON.parse(line) as StreamEvent;
        if (evt && (evt as StreamEvent).type) {
          yield evt;
        }
      } catch {
        // ignore malformed lines
      }
    }
  }
}

export class StreamTransport implements Transport {
  complete(params: Readonly<CompleteParams>): Stream<StreamEvent> {
    const controller = new AbortController();
    const body = JSON.stringify(buildBody(params));
    const execute = async function* () {
      const res = await fetch(`${API_BASE}/complete/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        yield { type: "done", error: `HTTP ${res.status}: ${res.statusText}${detail ? ` - ${detail}` : ""}` } as const;
        return;
      }
      const reader = res.body.getReader();
      for await (const evt of parseNdjson(reader)) {
        yield evt;
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
