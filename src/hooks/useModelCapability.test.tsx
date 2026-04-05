import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useModelCapability } from "@/hooks/useModelCapability";

function createSuccessResponse() {
  return new Response(
    JSON.stringify({
      choices: [{ logprobs: { content: [] } }],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function Harness({
  currentModelId,
  onStatus,
}: {
  currentModelId: string | null;
  onStatus?: (status: string) => void;
}) {
  const result = useModelCapability(
    { apiKey: "sk-test", baseUrl: "" },
    currentModelId,
  );

  useEffect(() => {
    onStatus?.(result.status);
  }, [onStatus, result.status]);

  return <div data-status={result.status} />;
}

describe("useModelCapability", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function renderHarness(modelId: string | null, onStatus?: (status: string) => void) {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness currentModelId={modelId} onStatus={onStatus} />
        </QueryClientProvider>,
      );
    });
  }

  it("debounces rapid model changes into a single network probe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse());
    vi.stubGlobal("fetch", fetchMock);

    renderHarness(null);
    renderHarness("model-a");

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    renderHarness("model-b");

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    renderHarness("model-c");

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("model-c");
  });

  it("aborts an in-flight probe when the selected model changes", async () => {
    let firstSignal: AbortSignal | undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        firstSignal = init?.signal as AbortSignal | undefined;
        return new Promise<Response>((_resolve, reject) => {
          firstSignal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      })
      .mockResolvedValueOnce(createSuccessResponse());

    vi.stubGlobal("fetch", fetchMock);

    renderHarness(null);
    renderHarness("model-a");

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstSignal?.aborted).toBe(false);

    renderHarness("model-b");

    await act(async () => {
      await Promise.resolve();
    });

    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(secondBody.model).toBe("model-b");
  });
});
