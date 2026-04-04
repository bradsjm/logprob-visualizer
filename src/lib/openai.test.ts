import {
  fetchProviderModels,
  normalizeLogprobsContent,
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

  it("classifies missing logprobs payload as unsupported", async () => {
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
      status: "unsupported",
      message: "Provider returned a completion without logprobs data.",
    });
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
});
