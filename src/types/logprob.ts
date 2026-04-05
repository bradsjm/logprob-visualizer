export interface Alt {
  token: string;
  logprob: number;
  prob: number;
}

export interface TokenLP {
  index: number;
  token: string;
  logprob: number;
  prob: number;
  top_logprobs: Alt[];
}

export interface CompletionLP {
  text: string;
  tokens: TokenLP[];
  finish_reason: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
  model: string;
  latency?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface RequestMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RunParameters {
  temperature: number;
  top_p: number;
  max_completion_tokens: number;
  top_logprobs: number;
  presence_penalty: number;
  frequency_penalty: number;
}

export interface ChatMessage {
  id: string;
  role: RequestMessage["role"];
  content: string;
  tokens?: TokenLP[];
}
