import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { LogprobChart } from "@/components/LogprobChart";

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: {
            width: 720,
            height: 256,
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            bottom: 256,
            right: 720,
            toJSON: () => ({}),
          },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }

  unobserve() {}

  disconnect() {}
}

describe("LogprobChart", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("supports keyboard activation and focus-driven highlighting", () => {
    const onTokenClick = vi.fn();
    const onTokenHover = vi.fn();

    act(() => {
      root.render(
        <LogprobChart
          tokens={[
            {
              index: 0,
              token: "hello",
              logprob: -0.2,
              prob: 0.82,
              top_logprobs: [],
            },
          ]}
          onTokenClick={onTokenClick}
          onTokenHover={onTokenHover}
        />,
      );
    });

    const point = container.querySelector('[role="button"]');
    expect(point?.tagName.toLowerCase()).toBe("circle");
    expect(point?.getAttribute("tabindex")).toBe("0");

    act(() => {
      point?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    expect(onTokenHover).toHaveBeenLastCalledWith(0);

    act(() => {
      point?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
    });
    expect(onTokenClick).toHaveBeenCalledWith(0);

    act(() => {
      point?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(onTokenHover).toHaveBeenLastCalledWith(null);
  });
});
