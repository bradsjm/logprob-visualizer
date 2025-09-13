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
  };
  model: string;
  latency?: number;
  force_prefix_echo?: string;
}

export interface BranchContext {
  tokenIndex: number;
  newToken: string;
  prefix: string;
  originalToken: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  supportsTopK: boolean;
}

export interface RunParameters {
  temperature: number;
  top_p: number;
  max_tokens: number;
  top_logprobs: number;
  presence_penalty: number;
  frequency_penalty: number;
  top_k?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tokens?: TokenLP[];
}