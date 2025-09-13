import type { CompletionLP } from "@/types/logprob";
import type { CompleteParams } from "@/lib/transport/rest";

export interface StreamDoneEvent {
  readonly type: "done";
  readonly completion?: CompletionLP;
  readonly error?: string;
}

export interface StreamDeltaEvent {
  readonly type: "delta";
  readonly delta: string; // incremental text
}

export type StreamEvent = StreamDeltaEvent | StreamDoneEvent;

export interface Stream<TEvent> extends AsyncIterable<TEvent> {
  readonly abort: () => void;
}

export interface Transport {
  /**
   * For REST transports, returns a Promise<CompletionLP>.
   * For streaming transports, returns a Stream<StreamEvent> that yields deltas and a final done event.
   */
  complete(params: Readonly<CompleteParams>): Promise<CompletionLP> | Stream<StreamEvent>;
}

