import type { CompletionLP, TokenLP } from "@/types/logprob";

export interface CompleteParams {
  readonly messages: readonly {
    readonly role: "user" | "assistant";
    readonly content: string;
  }[];
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

export interface StreamDoneEvent {
  readonly type: "done";
  readonly completion?: CompletionLP;
  readonly error?: string;
}

export interface StreamDeltaEvent {
  readonly type: "delta";
  readonly delta: string; // incremental text
}

export interface StreamLogprobsEvent {
  readonly type: "logprobs";
  readonly delta: TokenLP; // one token at a time from server
}

export type StreamEvent = StreamDeltaEvent | StreamLogprobsEvent | StreamDoneEvent;

export interface Stream<TEvent> extends AsyncIterable<TEvent> {
  readonly abort: () => void;
}

export interface Transport {
  /**
   * Starts a completion request and yields streaming events until completion.
   */
  complete(params: Readonly<CompleteParams>): Stream<StreamEvent>;
}
