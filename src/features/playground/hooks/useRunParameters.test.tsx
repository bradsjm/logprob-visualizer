import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { useRunParameters } from "@/features/playground/hooks/useRunParameters";

interface HarnessSnapshot {
  readonly selectedModelId: string | null;
  readonly temperature: number;
  readonly topP: number;
  readonly setSelectedModelId: (
    next: string | ((current: string | null) => string | null) | null,
  ) => void;
}

function Harness({
  onSnapshot,
}: {
  onSnapshot: (snapshot: HarnessSnapshot) => void;
}) {
  const {
    selectedModelId,
    setSelectedModelId,
    runParameters,
    applyRunParameterPatch,
  } = useRunParameters();

  useEffect(() => {
    onSnapshot({
      selectedModelId,
      temperature: runParameters.temperature,
      topP: runParameters.top_p,
      setSelectedModelId,
    });
  }, [onSnapshot, runParameters.temperature, runParameters.top_p, selectedModelId, setSelectedModelId]);

  return (
    <button
      type="button"
      onClick={() => applyRunParameterPatch({ temperature: 1.4 })}
    >
      update-temperature
    </button>
  );
}

describe("useRunParameters", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latestSnapshot: HarnessSnapshot | null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestSnapshot = null;
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    window.history.replaceState(
      {},
      "",
      "/?model=gpt-4.1&temperature=0.4&top_p=0.8",
    );
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  function renderHarness() {
    act(() => {
      root.render(
        <BrowserRouter>
          <Harness
            onSnapshot={(snapshot) => {
              latestSnapshot = snapshot;
            }}
          />
        </BrowserRouter>,
      );
    });
  }

  it("hydrates from and stays synchronized with the URL", async () => {
    renderHarness();

    expect(latestSnapshot?.selectedModelId).toBe("gpt-4.1");
    expect(latestSnapshot?.temperature).toBe(0.4);
    expect(latestSnapshot?.topP).toBe(0.8);

    const updateButton = container.querySelector("button");
    await act(async () => {
      updateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.location.search).toContain("temperature=1.40");

    await act(async () => {
      window.history.pushState({}, "", "/?model=gpt-4.1&temperature=0.9&top_p=0.3");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(latestSnapshot?.temperature).toBe(0.9);
    expect(latestSnapshot?.topP).toBe(0.3);

    await act(async () => {
      latestSnapshot?.setSelectedModelId("gpt-4.2");
    });

    expect(window.location.search).toContain("model=gpt-4.2");
  });
});
