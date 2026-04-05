import { createProviderConnection } from "@/lib/connection";
import type {
  ConnectionSettings,
  ModelCapability,
  ProviderConnection,
} from "@/types/connection";
import type { ModelInfo } from "@/types/logprob";

function buildHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function readErrorDetail(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}: ${response.statusText}`;
  const rawBody = await response.text().catch(() => "");
  const trimmedBody = rawBody.trim();

  if (!trimmedBody) {
    return fallback;
  }

  try {
    const body = JSON.parse(trimmedBody) as {
      error?: { message?: string };
      message?: string;
      detail?: string;
    };

    const detail =
      body.error?.message ?? body.message ?? body.detail ?? trimmedBody;
    return `HTTP ${response.status}: ${detail}`;
  } catch {
    return `HTTP ${response.status}: ${trimmedBody}`;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLogprobsUnsupportedError(detail: string): boolean {
  const mentionsLogprobs = /logprob|top_logprobs/i.test(detail);
  const indicatesUnsupported =
    /unsupported|not support|does not support|unknown parameter|invalid parameter/i.test(
      detail,
    );

  return mentionsLogprobs && indicatesUnsupported;
}

export class TransientModelCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientModelCapabilityError";
  }
}

export async function fetchProviderModels(
  connection: Readonly<ProviderConnection> | Readonly<ConnectionSettings>,
): Promise<ModelInfo[]> {
  const resolvedConnection =
    "resolvedBaseUrl" in connection
      ? connection
      : createProviderConnection(connection);
  const { resolvedBaseUrl, settings } = resolvedConnection;
  const response = await fetch(`${resolvedBaseUrl}/models`, {
    method: "GET",
    headers: buildHeaders(settings.apiKey),
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

  return models.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

export async function probeModelLogprobsSupport(
  connection: Readonly<ProviderConnection> | Readonly<ConnectionSettings>,
  modelId: string,
  signal?: AbortSignal,
): Promise<ModelCapability> {
  const resolvedConnection =
    "resolvedBaseUrl" in connection
      ? connection
      : createProviderConnection(connection);
  const { resolvedBaseUrl, settings } = resolvedConnection;
  const response = await fetch(`${resolvedBaseUrl}/chat/completions`, {
    method: "POST",
    headers: buildHeaders(settings.apiKey),
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: "." }],
      max_completion_tokens: 1,
      temperature: 0,
      logprobs: true,
      top_logprobs: 1,
      stream: false,
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    if (isLogprobsUnsupportedError(detail)) {
      return {
        status: "unsupported",
        message: detail,
      };
    }

    throw new TransientModelCapabilityError(detail);
  }

  const body = (await response.json()) as {
    choices?: Array<{
      logprobs?: { content?: unknown };
    }>;
  };
  const choice = body.choices?.[0];
  if (!isObject(choice)) {
    throw new TransientModelCapabilityError(
      "Provider returned an invalid capability probe response.",
    );
  }

  if (!("logprobs" in choice) || !isObject(choice.logprobs)) {
    return {
      status: "unsupported",
      message: "Provider returned a completion without logprobs data.",
    };
  }

  const content = choice.logprobs.content;
  if (content !== undefined && !Array.isArray(content)) {
    throw new TransientModelCapabilityError(
      "Provider returned an invalid logprobs payload.",
    );
  }

  return {
    status: "supported",
    message: null,
  };
}

export { readErrorDetail };
