import {
  fetchProviderModels,
  normalizeLogprobsContent,
  parseOpenAIStream,
  probeModelLogprobsSupport,
} from "@/lib/openai";

describe("openai client helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps provider models into ModelInfo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ id: "gpt-4.1" }, { id: "gpt-4.1-mini" }],
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
