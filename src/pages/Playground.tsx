import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  useDeferredValue,
} from "react";
import { useSearchParams } from "react-router-dom";

import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ChatTranscript } from "@/components/ChatTranscript";
import { Composer, type ComposerHandle } from "@/components/Composer";
import { ModelSelector } from "@/components/ModelSelector";
import { ParameterBadges } from "@/components/ParameterBadges";
import { PresetChips } from "@/components/PresetChips";
import { toast } from "@/components/ui/sonner";
import { useModels } from "@/hooks/useModels";
import { transport } from "@/lib/transport";
import { findNextLowConfidenceIndex } from "@/lib/utils";
import type { TokenLP } from "@/types/logprob";
import type { CompletionLP, ModelInfo, RunParameters, ChatMessage } from "@/types/logprob";
import type { Stream, StreamEvent } from "@/types/transport";

// Helper to build a consistent mock completion used for seeding and demo runs
const buildMockCompletion = (modelId: string): CompletionLP => ({
  text: "The Burj Khalifa in Dubai is currently the world's tallest building, measuring 828 meters (2,717 feet) in height.",
  tokens: [
    {
      index: 0,
      token: "The",
      logprob: -0.5,
      prob: 0.6065,
      top_logprobs: [
        { token: "The", logprob: -0.5, prob: 0.6065 },
        { token: "A", logprob: -1.2, prob: 0.3012 },
        { token: "Currently", logprob: -2.1, prob: 0.1224 },
      ],
    },
    {
      index: 1,
      token: " Burj",
      logprob: -0.1,
      prob: 0.9048,
      top_logprobs: [
        { token: " Burj", logprob: -0.1, prob: 0.9048 },
        { token: " tallest", logprob: -2.5, prob: 0.0821 },
      ],
    },
    {
      index: 2,
      token: " Khalifa",
      logprob: -0.05,
      prob: 0.9512,
      top_logprobs: [{ token: " Khalifa", logprob: -0.05, prob: 0.9512 }],
    },
    {
      index: 3,
      token: " in",
      logprob: -0.3,
      prob: 0.7408,
      top_logprobs: [
        { token: " in", logprob: -0.3, prob: 0.7408 },
        { token: " is", logprob: -1.1, prob: 0.3329 },
      ],
    },
    {
      index: 4,
      token: " Dubai",
      logprob: -0.2,
      prob: 0.8187,
      top_logprobs: [
        { token: " Dubai", logprob: -0.2, prob: 0.8187 },
        { token: " UAE", logprob: -1.8, prob: 0.1653 },
      ],
    },
    {
      index: 5,
      token: " is",
      logprob: -0.4,
      prob: 0.6703,
      top_logprobs: [
        { token: " is", logprob: -0.4, prob: 0.6703 },
        { token: " stands", logprob: -0.9, prob: 0.4066 },
      ],
    },
    {
      index: 6,
      token: " currently",
      logprob: -0.8,
      prob: 0.4493,
      top_logprobs: [
        { token: " currently", logprob: -0.8, prob: 0.4493 },
        { token: " the", logprob: -1.0, prob: 0.3679 },
      ],
    },
    {
      index: 7,
      token: " the",
      logprob: -0.3,
      prob: 0.7408,
      top_logprobs: [{ token: " the", logprob: -0.3, prob: 0.7408 }],
    },
    {
      index: 8,
      token: " world",
      logprob: -0.2,
      prob: 0.8187,
      top_logprobs: [{ token: " world", logprob: -0.2, prob: 0.8187 }],
    },
    {
      index: 9,
      token: "'s",
      logprob: -0.1,
      prob: 0.9048,
      top_logprobs: [{ token: "'s", logprob: -0.1, prob: 0.9048 }],
    },
    {
      index: 10,
      token: " tallest",
      logprob: -0.15,
      prob: 0.8607,
      top_logprobs: [
        { token: " tallest", logprob: -0.15, prob: 0.8607 },
        { token: " largest", logprob: -2.2, prob: 0.1108 },
      ],
    },
    {
      index: 11,
      token: " building",
      logprob: -0.1,
      prob: 0.9048,
      top_logprobs: [
        { token: " building", logprob: -0.1, prob: 0.9048 },
        { token: " structure", logprob: -2.5, prob: 0.0821 },
      ],
    },
    {
      index: 12,
      token: ",",
      logprob: -0.5,
      prob: 0.6065,
      top_logprobs: [
        { token: ",", logprob: -0.5, prob: 0.6065 },
        { token: " in", logprob: -1.2, prob: 0.3012 },
      ],
    },
    {
      index: 13,
      token: " measuring",
      logprob: -0.88,
      prob: 0.4141,
      top_logprobs: [
        { token: " measuring", logprob: -0.88, prob: 0.4141 },
        { token: " standing", logprob: -1.15, prob: 0.318 },
        { token: " with", logprob: -2.45, prob: 0.0862 },
        { token: " reaching", logprob: -2.51, prob: 0.0813 },
        { token: " at", logprob: -2.66, prob: 0.0701 },
      ],
    },
    {
      index: 14,
      token: " 828",
      logprob: -0.3,
      prob: 0.7408,
      top_logprobs: [{ token: " 828", logprob: -0.3, prob: 0.7408 }],
    },
    {
      index: 15,
      token: " meters",
      logprob: -0.4,
      prob: 0.6703,
      top_logprobs: [
        { token: " meters", logprob: -0.4, prob: 0.6703 },
        { token: " m", logprob: -1.1, prob: 0.3329 },
      ],
    },
  ],
  finish_reason: "stop",
  usage: { prompt_tokens: 12, completion_tokens: 16, total_tokens: 28 },
  model: modelId,
  latency: 1240,
});

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

const DEFAULT_PARAMS: Readonly<RunParameters> = Object.freeze({
  temperature: 0.7,
  top_p: 1.0,
  max_tokens: 128,
  top_logprobs: 5,
  presence_penalty: 0,
  frequency_penalty: 0,
});

const Playground = () => {
  const { models } = useModels();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial state from URL (idempotent on first render)
  const initialModelId = searchParams.get("model") ?? "gpt-4o";
  const [selectedModel, setSelectedModel] = useState<ModelInfo>({
    id: initialModelId,
    name: initialModelId,
  });
  const seed = buildMockCompletion(selectedModel.id);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: seed.text, tokens: seed.tokens as TokenLP[] },
  ]);
  // Branching UI removed; no branch context state
  const [currentCompletion, setCurrentCompletion] =
    useState<CompletionLP | null>(seed);
  const initialParams: RunParameters = useMemo(() => {
    const n = (
      key: keyof RunParameters,
      def: number,
      min: number,
      max: number,
    ): number => {
      const raw = searchParams.get(key as string);
      if (raw == null) return def;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? clamp(parsed, min, max) : def;
    };
    return {
      temperature: n("temperature", DEFAULT_PARAMS.temperature, 0, 2),
      top_p: n("top_p", DEFAULT_PARAMS.top_p, 0, 1),
      max_tokens: Math.round(
        n("max_tokens", DEFAULT_PARAMS.max_tokens, 1, 256),
      ),
      top_logprobs: Math.round(
        n("top_logprobs", DEFAULT_PARAMS.top_logprobs, 1, 10),
      ),
      presence_penalty: n(
        "presence_penalty",
        DEFAULT_PARAMS.presence_penalty,
        -2,
        2,
      ),
      frequency_penalty: n(
        "frequency_penalty",
        DEFAULT_PARAMS.frequency_penalty,
        -2,
        2,
      ),
    } satisfies RunParameters;
  }, [searchParams]);

  const [runParameters, setRunParameters] =
    useState<RunParameters>(initialParams);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStream, setActiveStream] = useState<Stream<StreamEvent> | null>(
    null,
  );
  const cancelRequestedRef = useRef(false);
  const [showWhitespaceOverlays, setShowWhitespaceOverlays] = useState(false);
  const [showPunctuationOverlays, setShowPunctuationOverlays] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [lastLowIndex, setLastLowIndex] = useState<number | null>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const [isChartPending, startChartTransition] = useTransition();
  const deferredCompletion = useDeferredValue(currentCompletion);

  // Announce chart rendering status for a11y
  useEffect(() => {
    if (isChartPending) setLiveMessage("Rendering analysis…");
  }, [isChartPending]);
  useEffect(() => {
    if (!isChartPending && currentCompletion) setLiveMessage("Response ready");
  }, [isChartPending, currentCompletion]);

  // Reconcile selected model object once models list arrives
  useEffect(() => {
    if (!models.length) return;
    const match = models.find((m) => m.id === selectedModel.id);
    if (match) {
      if (match.name !== selectedModel.name) setSelectedModel(match);
    } else {
      setSelectedModel(models[0]!);
      toast("Model updated", { description: `Selected ${models[0]!.name}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  // Keep URL in sync with current selection/parameters
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set("model", selectedModel.id);
    next.set("temperature", runParameters.temperature.toFixed(2));
    next.set("top_p", runParameters.top_p.toFixed(2));
    next.set("max_tokens", String(runParameters.max_tokens));
    next.set("top_logprobs", String(runParameters.top_logprobs));
    next.set("presence_penalty", runParameters.presence_penalty.toFixed(2));
    next.set("frequency_penalty", runParameters.frequency_penalty.toFixed(2));
    setSearchParams(next, { replace: true });
  }, [selectedModel.id, runParameters, searchParams, setSearchParams]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage = { role: "user" as const, content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setLiveMessage("Sending request...");

    try {
      const result = transport.complete({
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        model: selectedModel.id,
        temperature: runParameters.temperature,
        top_p: runParameters.top_p,
        presence_penalty: runParameters.presence_penalty,
        frequency_penalty: runParameters.frequency_penalty,
        max_tokens: runParameters.max_tokens,
        top_logprobs: runParameters.top_logprobs,
      });

      if (typeof (result as Promise<unknown>).then === "function") {
        // REST mode
        const response = (await result) as CompletionLP;
        const assistantMessage = {
          role: "assistant" as const,
          content: response.text,
          tokens: response.tokens,
        };
        setMessages([...newMessages, assistantMessage]);
        startChartTransition(() => setCurrentCompletion(response));
        // Live region updated to "Response ready" once transition completes (see effect below)
      } else {
        // Streaming mode
        let streamText = "";
        // Buffer incoming tokens; flush at most once per animation frame
        const tokensBufferRef = { current: [] as TokenLP[] };
        let flushScheduled = false;
        let flushRaf: number | null = null;
        let haveShownTokens = false;

        const scheduleFlush = () => {
          if (flushScheduled) return;
          flushScheduled = true;
          flushRaf = requestAnimationFrame(() => {
            flushScheduled = false;
            flushRaf = null;
            const buffered = tokensBufferRef.current;
            if (buffered.length === 0) return;
            // First time tokens arrive, switch message view to TokenText
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1] as ChatMessage | undefined;
              if (!last) return prev;
              const existingTokens = last.tokens as TokenLP[] | undefined;
              const merged = existingTokens && existingTokens.length > 0
                ? [...existingTokens, ...buffered]
                : [...buffered];
              next[next.length - 1] = {
                role: "assistant" as const,
                content: streamText,
                tokens: merged,
              };
              return next;
            });
            tokensBufferRef.current = [];
            haveShownTokens = true;
          });
        };

        const cancelPendingFlush = () => {
          if (flushRaf !== null) {
            cancelAnimationFrame(flushRaf);
            flushRaf = null;
          }
          flushScheduled = false;
          tokensBufferRef.current = [];
        };

        const assistantMessage = { role: "assistant" as const, content: streamText };
        setMessages((prev) => [...prev, assistantMessage]);
        const stream = result as Stream<StreamEvent>;
        setActiveStream(stream);
        try {
          for await (const evt of stream) {
            if (evt.type === "delta") {
              streamText += evt.delta;
              // Only update text if we haven't switched to token view yet
              if (!haveShownTokens) {
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = { role: "assistant" as const, content: streamText };
                  return next;
                });
              }
              setLiveMessage("Streaming response…");
            } else if (evt.type === "logprobs") {
              tokensBufferRef.current.push(evt.delta);
              scheduleFlush();
            } else if (evt.type === "done") {
              cancelPendingFlush();
              if (evt.error) {
                toast("Streaming error", { description: evt.error });
              }
              const finalText = evt.completion?.text ?? streamText;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: "assistant" as const,
                  content: finalText,
                  tokens: evt.completion?.tokens,
                };
                return next;
              });
              if (evt.completion) {
                // Deprioritize chart render so final text paints first
                startChartTransition(() => setCurrentCompletion(evt.completion!));
                // Live region will be set when transition completes
              } else {
                setLiveMessage("Response complete (no chart data)");
              }
            }
          }
        } catch (err) {
          const name = (err as { name?: string } | null)?.name;
          if (name === "AbortError" || cancelRequestedRef.current) {
            setLiveMessage("Streaming canceled");
            // leave partial message as-is; no chart update
          } else {
            throw err;
          }
        } finally {
          cancelPendingFlush();
          setActiveStream(null);
          cancelRequestedRef.current = false;
        }
      }
    } catch (error) {
      const message = (error as Error).message;
      console.error("Error generating response:", message);
      toast("Request failed", { description: message });
      setLiveMessage("Request failed. Focus returned to composer.");
      // Accessibility: restore focus to composer on error
      composerRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleBranch = (tokenIndex: number, newToken: string) => {
    if (!currentCompletion) return;

    const prefix = currentCompletion.tokens
      .slice(0, tokenIndex)
      .map((t) => t.token)
      .join("");

    // UX simplification: prefill composer input instead of branching UI
    const prefill = prefix + newToken;
    composerRef.current?.setMessage(prefill);
    composerRef.current?.focus();
    // Ensure any previous branch state is cleared so no badges/messages show
    // branching UI removed; nothing to clear
  };

  // clearBranch removed

  // Keyboard shortcuts: '/', '.', '[' and ']'
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        (target as HTMLElement | null)?.isContentEditable;
      if (isTyping) return;

      if (e.key === "/") {
        e.preventDefault();
        composerRef.current?.focus();
        setLiveMessage("Composer focused");
      } else if (e.key === ".") {
        e.preventDefault();
        composerRef.current?.openParameters();
        setLiveMessage("Parameters opened");
      } else if (e.key === "[" || e.key === "]") {
        if (!currentCompletion) return;
        e.preventDefault();
        const direction = e.key === "]" ? 1 : (-1 as 1 | -1);
        const next = findNextLowConfidenceIndex(
          currentCompletion.tokens,
          lastLowIndex,
          direction,
          0.5,
        );
        if (next !== null) {
          setLastLowIndex(next);
          const el = document.querySelector(`[data-token-index="${next}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          (el as HTMLElement | null)?.focus?.();
          setLiveMessage(`Jumped to low-confidence token ${next}`);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentCompletion, lastLowIndex]);

  // Track the currently highlighted token index (hover from chart) for DOM-based highlighting
  const lastHoverRef = useRef<number | null>(null);

  const handleChartHover = (tokenIndex: number | null) => {
    const prev = lastHoverRef.current;
    if (typeof prev === "number") {
      const prevEl = document.querySelector(`[data-token-index="${prev}"]`);
      prevEl?.classList.remove("token-chart-hover");
    }
    lastHoverRef.current = tokenIndex;
    if (typeof tokenIndex === "number") {
      const el = document.querySelector(`[data-token-index="${tokenIndex}"]`);
      el?.classList.add("token-chart-hover");
    }
  };

  return (
    <div className="workspace-container">
      {/* Live region for a11y announcements */}
      <div aria-live="polite" className="sr-only" role="status">
        {liveMessage}
      </div>
      {/* Header */}
      <header className="border-b bg-surface/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-foreground">
            Logprob Visualizer
          </h1>
          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            onModelChange={(model) => {
              setSelectedModel(model);
            }}
            temperature={runParameters.temperature}
            onTemperatureChange={(value) =>
              setRunParameters((prev) => ({
                ...prev,
                temperature: clamp(value, 0, 2),
              }))
            }
          />
          <PresetChips
            onApplyPreset={(patch) =>
              setRunParameters((prev) => ({ ...prev, ...patch }))
            }
          />
        </div>
        <div className="flex items-center gap-3">
          <ParameterBadges parameters={runParameters} />
        </div>
      </header>

      {/* Main workspace */}
      <main className="workspace-main">
        {/* Chat transcript */}
        <div className="transcript-panel">
          <ChatTranscript
            messages={messages}
            isLoading={isLoading}
            onTokenClick={handleBranch}
            currentCompletion={currentCompletion}
            showWhitespaceOverlays={showWhitespaceOverlays}
            showPunctuationOverlays={showPunctuationOverlays}
          />
          <Composer
            ref={composerRef}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            isStreaming={activeStream !== null}
            onCancel={() => {
              if (activeStream) {
                cancelRequestedRef.current = true;
                activeStream.abort();
              }
            }}
            parameters={runParameters}
            onParametersChange={setRunParameters}
            showWhitespaceOverlays={showWhitespaceOverlays}
            showPunctuationOverlays={showPunctuationOverlays}
            onReadabilityChange={(patch) => {
              if (typeof patch.showWhitespace === "boolean")
                setShowWhitespaceOverlays(patch.showWhitespace);
              if (typeof patch.showPunctuation === "boolean")
                setShowPunctuationOverlays(patch.showPunctuation);
            }}
            onClearHistory={() => {
              setMessages([]);
              setCurrentCompletion(null);
              setLiveMessage("History cleared");
              composerRef.current?.focus();
            }}
          />
        </div>

        {/* Analysis panel */}
        <AnalysisPanel
          completion={deferredCompletion}
          isLoadingChart={isChartPending}
          onTokenClick={(tokenIndex) => {
            // Scroll to token and highlight
            const tokenElement = document.querySelector(
              `[data-token-index="${tokenIndex}"]`,
            );
            tokenElement?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }}
          onTokenHover={handleChartHover}
        />
      </main>
    </div>
  );
};

export default Playground;
