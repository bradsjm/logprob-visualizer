import { act, forwardRef, useImperativeHandle } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import Playground from "@/pages/Playground";
import type { Stream, StreamEvent } from "@/types/transport";

const mockComplete = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/hooks/useConnectionSettings", () => ({
  useConnectionSettings: () => ({
    settings: { apiKey: "sk-test", baseUrl: "" },
    connection: {
      settings: { apiKey: "sk-test", baseUrl: "" },
      resolvedBaseUrl: "https://api.openai.com/v1",
      cacheKey: "https://api.openai.com/v1:test",
      hasSavedSettings: true,
    },
    resolvedBaseUrl: "https://api.openai.com/v1",
    hasSavedSettings: true,
    saveSettings: vi.fn(),
    clearSettings: vi.fn(),
  }),
}));

vi.mock("@/hooks/useModels", () => ({
  useModels: () => ({
    models: [{ id: "gpt-4.1", name: "gpt-4.1" }],
    isLoading: false,
    isError: false,
    errorMessage: null,
  }),
}));

vi.mock("@/hooks/useModelCapability", () => ({
  useModelCapability: () => ({
    status: "supported",
    message: null,
    isLoading: false,
  }),
}));

vi.mock("@/lib/transport/stream", () => ({
  StreamTransport: class {
    complete = mockComplete;
  },
}));

vi.mock("@/components/AnalysisPanel", () => ({
  AnalysisPanel: () => <div>analysis</div>,
}));

vi.mock("@/components/ConnectionSettingsDialog", () => ({
  ConnectionSettingsDialog: () => null,
}));

vi.mock("@/components/ModelSelector", () => ({
  ModelSelector: () => <div>model-selector</div>,
}));

vi.mock("@/components/ParameterBadges", () => ({
  ParameterBadges: () => <div>badges</div>,
}));

vi.mock("@/components/PresetChips", () => ({
  PresetChips: () => <div>presets</div>,
}));

vi.mock("@/components/ChatTranscript", () => ({
  ChatTranscript: ({
    messages,
    onRegenerateMessage,
    regenerableMessageId,
    isRegenerateDisabled,
  }: {
    messages: Array<{ id: string; role: string; content: string }>;
    onRegenerateMessage?: (messageId: string) => void;
    regenerableMessageId?: string | null;
    isRegenerateDisabled?: boolean;
  }) => (
    <div data-testid="messages">
      {messages.map((message, index) => (
        <div key={`${message.role}-${index}`}>
          {message.role}:{message.content}:{message.id}
        </div>
      ))}
      {regenerableMessageId && onRegenerateMessage ? (
        <button
          type="button"
          disabled={isRegenerateDisabled}
          onClick={() => onRegenerateMessage(regenerableMessageId)}
        >
          regenerate
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("@/components/Composer", () => ({
  Composer: forwardRef(function MockComposer(
    {
      onSendMessage,
      onCancel,
      isStreaming,
    }: {
      onSendMessage: (content: string) => void;
      onCancel?: () => void;
      isStreaming?: boolean;
    },
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      focus: vi.fn(),
      openParameters: vi.fn(),
      setMessage: vi.fn(),
    }));

    return (
      <div>
        <button type="button" onClick={() => onSendMessage("hello")}>
          send
        </button>
        {isStreaming ? (
          <button type="button" onClick={() => onCancel?.()}>
            cancel
          </button>
        ) : null}
      </div>
    );
  }),
}));

describe("Playground request lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockComplete.mockReset();
    mockToast.mockReset();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderPlayground() {
    act(() => {
      root.render(
        <MemoryRouter>
          <Playground />
        </MemoryRouter>,
      );
    });
  }

  function findButtonByText(text: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === text,
    );
  }

  function createCompletionStream(
    completion: { text: string; model?: string } = { text: "first response" },
  ): Stream<StreamEvent> {
    return {
      abort: vi.fn(),
      async *[Symbol.asyncIterator]() {
        yield {
          type: "delta",
          delta: completion.text,
        } as const;
        yield {
          type: "done",
          completion: {
            text: completion.text,
            tokens: [],
            finish_reason: "stop",
            usage: {
              prompt_tokens: 1,
              completion_tokens: 1,
              total_tokens: 2,
            },
            model: completion.model ?? "gpt-4.1",
          },
        } as const;
      },
    };
  }

  it("removes the optimistic assistant message after a request failure", async () => {
    mockComplete.mockReturnValue({
      abort: vi.fn(),
      [Symbol.asyncIterator]() {
        return {
          next: async () => {
            throw new Error("network boom");
          },
        };
      },
    } satisfies Stream<StreamEvent>);

    renderPlayground();

    const sendButton = findButtonByText("send");
    expect(sendButton).not.toBeNull();

    await act(async () => {
      sendButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const transcript = container.querySelector('[data-testid="messages"]');
    expect(transcript?.textContent).toContain("user:hello");
    expect(transcript?.textContent).not.toContain("assistant:");
  });

  it("removes the optimistic assistant message after canceling a stream", async () => {
    let rejectPending:
      | ((reason?: unknown) => void)
      | null = null;

    const stream = {
      abort: () => {
        rejectPending?.(new DOMException("Aborted", "AbortError"));
      },
      async *[Symbol.asyncIterator]() {
        yield {
          type: "delta",
          delta: "partial",
        } as const;

        await new Promise<never>((_resolve, reject) => {
          rejectPending = reject;
        });
      },
    } satisfies Stream<StreamEvent>;

    mockComplete.mockReturnValue(stream);

    renderPlayground();

    const sendButton = findButtonByText("send");
    expect(sendButton).not.toBeNull();

    await act(async () => {
      sendButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const cancelButton = findButtonByText("cancel");
    expect(cancelButton).not.toBeUndefined();

    await act(async () => {
      cancelButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    const transcript = container.querySelector('[data-testid="messages"]');
    expect(transcript?.textContent).toContain("user:hello");
    expect(transcript?.textContent).not.toContain("assistant:");
  });

  it("regenerates the latest assistant message in place", async () => {
    mockComplete
      .mockReturnValueOnce(createCompletionStream({ text: "first response" }))
      .mockReturnValueOnce(createCompletionStream({ text: "second response" }));

    renderPlayground();

    const sendButton = findButtonByText("send");
    expect(sendButton).not.toBeUndefined();

    await act(async () => {
      sendButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const regenerateButton = findButtonByText("regenerate");
    expect(regenerateButton).not.toBeUndefined();

    await act(async () => {
      regenerateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const transcript = container.querySelector('[data-testid="messages"]');
    expect(transcript?.textContent).toContain("user:hello");
    expect(transcript?.textContent).toContain("assistant:second response");
    expect(transcript?.textContent).not.toContain("assistant:first response");

    expect(mockComplete).toHaveBeenCalledTimes(2);
    expect(mockComplete.mock.calls[0]?.[0]).toMatchObject({
      messages: [{ role: "user", content: "hello" }],
      model: "gpt-4.1",
    });
    expect(mockComplete.mock.calls[1]?.[0]).toMatchObject({
      messages: [{ role: "user", content: "hello" }],
      model: "gpt-4.1",
    });
  });

  it("restores the previous assistant message when regeneration fails", async () => {
    mockComplete
      .mockReturnValueOnce(createCompletionStream({ text: "first response" }))
      .mockReturnValueOnce({
        abort: vi.fn(),
        [Symbol.asyncIterator]() {
          return {
            next: async () => {
              throw new Error("regen boom");
            },
          };
        },
      } satisfies Stream<StreamEvent>);

    renderPlayground();

    const sendButton = findButtonByText("send");
    expect(sendButton).not.toBeUndefined();

    await act(async () => {
      sendButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const regenerateButton = findButtonByText("regenerate");
    expect(regenerateButton).not.toBeUndefined();

    await act(async () => {
      regenerateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const transcript = container.querySelector('[data-testid="messages"]');
    expect(transcript?.textContent).toContain("assistant:first response");
    expect(transcript?.textContent).not.toContain("assistant::");
  });
});
