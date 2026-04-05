import { StreamTransport } from "@/lib/transport/stream";

describe("StreamTransport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("turns streamed provider error chunks into terminal errors", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"error":{"message":"model overloaded"}}\n\n',
          ),
        );
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    const transport = new StreamTransport({ apiKey: "sk-test", baseUrl: "" });
    const events = [];

    for await (const event of transport.complete({
      messages: [{ role: "user", content: "hello" }],
      model: "gpt-4.1",
      temperature: 0.7,
      top_p: 1,
      presence_penalty: 0,
      frequency_penalty: 0,
      max_completion_tokens: 8,
      top_logprobs: 5,
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: "done",
        error: "model overloaded",
      },
    ]);
  });

  it("requests streamed usage counts from the provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const transport = new StreamTransport({ apiKey: "sk-test", baseUrl: "" });

    for await (const _event of transport.complete({
      messages: [{ role: "user", content: "hello" }],
      model: "gpt-4.1",
      temperature: 0.7,
      top_p: 1,
      presence_penalty: 0,
      frequency_penalty: 0,
      max_completion_tokens: 8,
      top_logprobs: 5,
    })) {
      // drain stream
    }

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.stream_options).toEqual({ include_usage: true });
  });
});
