import {
  extractStreamError,
  fetchProviderModels,
  normalizeLogprobsContent,
  parseOpenAIStream,
  probeModelLogprobsSupport,
  readErrorDetail,
} from "@/lib/openai";

describe("openai client helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps provider models into sorted ModelInfo entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              { id: "gpt-4.1-mini" },
              { id: "gpt-4.1" },
              { id: "gpt-4.1-nano" },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      fetchProviderModels({ apiKey: "sk-test", baseUrl: "" }),
    ).resolves.toEqual([
      { id: "gpt-4.1", name: "gpt-4.1" },
      { id: "gpt-4.1-mini", name: "gpt-4.1-mini" },
      { id: "gpt-4.1-nano", name: "gpt-4.1-nano" },
    ]);
  });

  it("classifies a missing logprobs object as unsupported", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{}],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      probeModelLogprobsSupport({ apiKey: "sk-test", baseUrl: "" }, "gpt-4.1"),
    ).resolves.toEqual({
      status: "unsupported",
      message: "Provider returned a completion without logprobs data.",
    });
  });

  it("forwards an abort signal during capability probes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ logprobs: { content: [] } }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();

    await probeModelLogprobsSupport(
      { apiKey: "sk-test", baseUrl: "" },
      "gpt-4.1",
      controller.signal,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });

  it("treats an empty logprobs array as supported", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ logprobs: { content: [] } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      probeModelLogprobsSupport({ apiKey: "sk-test", baseUrl: "" }, "gpt-4.1"),
    ).resolves.toEqual({
      status: "supported",
      message: null,
    });
  });

  it("treats transient probe failures as errors instead of unsupported", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "upstream timeout" },
          }),
          {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      probeModelLogprobsSupport({ apiKey: "sk-test", baseUrl: "" }, "gpt-4.1"),
    ).rejects.toThrow("HTTP 503: upstream timeout");
  });

  it("does not misclassify generic parameter validation errors as unsupported", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "unknown parameter: temperature" },
          }),
          {
            status: 400,
            statusText: "Bad Request",
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      probeModelLogprobsSupport({ apiKey: "sk-test", baseUrl: "" }, "gpt-4.1"),
    ).rejects.toThrow("HTTP 400: unknown parameter: temperature");
  });

  it("preserves plain-text provider errors", async () => {
    const response = new Response("upstream proxy failed", {
      status: 502,
      statusText: "Bad Gateway",
      headers: { "Content-Type": "text/plain" },
    });

    await expect(readErrorDetail(response)).resolves.toBe(
      "HTTP 502: upstream proxy failed",
    );
  });

  it("extracts streamed provider errors from OpenAI-compatible chunks", () => {
    expect(
      extractStreamError({
        error: { message: "model overloaded" },
      }),
    ).toBe("model overloaded");

    expect(
      extractStreamError({
        message: "gateway timeout",
      }),
    ).toBe("gateway timeout");
  });

  it("normalizes token-level logprobs", () => {
    expect(
      normalizeLogprobsContent(
        [
          {
            token: "hello",
            logprob: -0.2,
            top_logprobs: [{ token: "hello", logprob: -0.2 }],
          },
        ],
        3,
      ),
    ).toEqual([
      {
        index: 3,
        token: "hello",
        logprob: -0.2,
        prob: Math.exp(-0.2),
        top_logprobs: [
          {
            token: "hello",
            logprob: -0.2,
            prob: Math.exp(-0.2),
          },
        ],
      },
    ]);
  });

  it("leaves usage null when no provider usage is available", async () => {
    const { buildCompletionFromState } = await import("@/lib/openai");

    expect(
      buildCompletionFromState(
        {
          messages: [{ role: "user", content: "hello" }],
          model: "gpt-4.1",
          temperature: 0.7,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          max_completion_tokens: 8,
          top_logprobs: 5,
        },
        Date.now(),
        {
          aggregatedText: "hello",
          tokens: [],
          finishReason: "stop",
          usage: null,
          model: "gpt-4.1",
        },
      ).usage,
    ).toBeNull();
  });

  it("flushes the final UTF-8 chunk in streamed SSE responses", async () => {
    const payload = 'data: {"token":"🙂"}\n\n';
    const encoded = new TextEncoder().encode(payload);
    const emojiOffset = payload.indexOf("🙂");
    const firstChunk = encoded.slice(0, emojiOffset + 1);
    const secondChunk = encoded.slice(emojiOffset + 1);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(firstChunk);
        controller.enqueue(secondChunk);
        controller.close();
      },
    });

    const events: string[] = [];
    for await (const event of parseOpenAIStream(stream.getReader())) {
      events.push(event);
    }

    expect(events).toEqual(['{"token":"🙂"}']);
  });
});
