import { AlertCircle, KeyRound, Loader2 } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useDeferredValue,
  useTransition,
} from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ChatTranscript } from "@/components/ChatTranscript";
import { Composer, type ComposerHandle } from "@/components/Composer";
import { ConnectionSettingsDialog } from "@/components/ConnectionSettingsDialog";
import { ModelSelector } from "@/components/ModelSelector";
import { ParameterBadges } from "@/components/ParameterBadges";
import { PresetChips } from "@/components/PresetChips";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConnectionSettings } from "@/hooks/useConnectionSettings";
import { useModelCapability } from "@/hooks/useModelCapability";
import { useModels } from "@/hooks/useModels";
import { createTransport } from "@/lib/transport";
import { findNextLowConfidenceIndex } from "@/lib/utils";
import type { TokenLP } from "@/types/logprob";
import type { ChatMessage, CompletionLP, RunParameters } from "@/types/logprob";
import type { Stream, StreamEvent } from "@/types/transport";

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

const DEFAULT_PARAMS: Readonly<RunParameters> = Object.freeze({
  temperature: 0.7,
  top_p: 1.0,
  max_completion_tokens: 128,
  top_logprobs: 5,
  presence_penalty: 0,
  frequency_penalty: 0,
});

/**
 * Main playground view combining chat, analysis, and parameter controls for logprob exploration.
 */
const Playground = () => {
  const {
    settings,
    resolvedBaseUrl,
    hasSavedSettings,
    saveSettings,
    clearSettings,
  } = useConnectionSettings();
  const { models, isLoading: isModelsLoading, isError: isModelsError, errorMessage } =
    useModels(settings, resolvedBaseUrl);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    () => searchParams.get("model"),
  );
  const selectedModel =
    models.find((model) => model.id === selectedModelId) ?? null;
  const capability = useModelCapability(settings, selectedModel?.id ?? null);
  const transport = useMemo(
    () => createTransport(settings),
    [settings],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Branching UI removed; no branch context state
  const [currentCompletion, setCurrentCompletion] =
    useState<CompletionLP | null>(null);
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
      max_completion_tokens: Math.round(
        n(
          "max_completion_tokens",
          DEFAULT_PARAMS.max_completion_tokens,
          1,
          256,
        ),
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
    if (!hasSavedSettings || models.length === 0) {
      return;
    }

    const hasSelectedModel = selectedModelId
      ? models.some((model) => model.id === selectedModelId)
      : false;
    if (hasSelectedModel) {
      return;
    }

    const nextModel = models[0] ?? null;
    if (!nextModel) {
      setSelectedModelId(null);
      return;
    }

    setSelectedModelId(nextModel.id);
    if (selectedModelId) {
      toast("Model updated", {
        description: `Selected ${nextModel.name}`,
      });
    }
  }, [hasSavedSettings, models, selectedModelId]);

  // Keep URL in sync with current selection/parameters
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedModelId) next.set("model", selectedModelId);
    else next.delete("model");
    next.set("temperature", runParameters.temperature.toFixed(2));
    next.set("top_p", runParameters.top_p.toFixed(2));
    next.set(
      "max_completion_tokens",
      String(runParameters.max_completion_tokens),
    );
    next.set("top_logprobs", String(runParameters.top_logprobs));
    next.set("presence_penalty", runParameters.presence_penalty.toFixed(2));
    next.set("frequency_penalty", runParameters.frequency_penalty.toFixed(2));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [runParameters, searchParams, selectedModelId, setSearchParams]);

  const lastCapabilityToastRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedModel || capability.status !== "unsupported") {
      return;
    }

    const nextKey = `${resolvedBaseUrl}:${selectedModel.id}`;
    if (lastCapabilityToastRef.current === nextKey) {
      return;
    }

    lastCapabilityToastRef.current = nextKey;
    toast("Selected model is incompatible", {
      description:
        capability.message ??
        "This model does not return logprobs and cannot be used here.",
    });
  }, [capability.message, capability.status, resolvedBaseUrl, selectedModel]);

  const blockState = useMemo(() => {
    if (!hasSavedSettings) {
      return {
        title: "Connection settings required",
        description:
          "Add an API key before loading models or generating completions.",
        kind: "missing-settings" as const,
      };
    }

    if (isModelsLoading) {
      return {
        title: "Loading models",
        description: "Fetching models from the configured provider.",
        kind: "loading-models" as const,
      };
    }

    if (isModelsError) {
      return {
        title: "Model discovery failed",
        description:
          errorMessage ??
          "The provider did not return a usable models response.",
        kind: "model-error" as const,
      };
    }

    if (!selectedModel) {
      return {
        title: "No model selected",
        description: "Choose a provider model before sending a prompt.",
        kind: "missing-model" as const,
      };
    }

    if (capability.status === "checking") {
      return {
        title: "Checking logprobs support",
        description: "Verifying that the selected model supports logprobs.",
        kind: "checking-capability" as const,
      };
    }

    if (capability.status === "unsupported") {
      return {
        title: "Selected model does not support logprobs",
        description:
          capability.message ??
          "Choose a different model. This app requires logprobs for analysis.",
        kind: "unsupported-model" as const,
      };
    }

    if (capability.status === "unknown") {
      return {
        title: "Unable to verify model capability",
        description:
          capability.message ??
          "Capability probing failed, so generation remains blocked.",
        kind: "unknown-capability" as const,
      };
    }

    return null;
  }, [
    capability.message,
    capability.status,
    errorMessage,
    hasSavedSettings,
    isModelsError,
    isModelsLoading,
    selectedModel,
  ]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;
    if (!selectedModel || blockState) {
      if (blockState?.kind === "missing-settings") {
        setIsSettingsOpen(true);
      }
      toast("Cannot send request", {
        description:
          blockState?.description ??
          "Select a compatible model before sending a request.",
      });
      return;
    }

    const userMessage = { role: "user" as const, content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setLiveMessage("Sending request...");

    try {
      const stream = transport.complete({
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        model: selectedModel.id,
        temperature: runParameters.temperature,
        top_p: runParameters.top_p,
        presence_penalty: runParameters.presence_penalty,
        frequency_penalty: runParameters.frequency_penalty,
        max_completion_tokens: runParameters.max_completion_tokens,
        top_logprobs: runParameters.top_logprobs,
      });

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
      <ConnectionSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        resolvedBaseUrl={resolvedBaseUrl}
        onSave={(nextSettings) => {
          saveSettings(nextSettings);
          toast("Connection settings saved", {
            description: "Refreshing provider models.",
          });
        }}
        onClear={() => {
          clearSettings();
          setSelectedModelId(null);
          setCurrentCompletion(null);
          setMessages([]);
          toast("Connection settings cleared");
        }}
      />
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
            selectedModelId={selectedModelId}
            onModelChange={setSelectedModelId}
            temperature={runParameters.temperature}
            disabled={!hasSavedSettings}
            isLoading={isModelsLoading}
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
          <Button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            variant={hasSavedSettings ? "outline" : "default"}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {hasSavedSettings ? "Connection Settings" : "Set API Key"}
          </Button>
          <ParameterBadges parameters={runParameters} />
        </div>
      </header>

      {/* Main workspace */}
      <main className="workspace-main">
        {/* Chat transcript */}
        <div className="transcript-panel">
          {blockState ? (
            <div className="px-6 pt-4">
              <Alert
                variant={
                  blockState.kind === "unsupported-model" ||
                  blockState.kind === "unknown-capability" ||
                  blockState.kind === "model-error"
                    ? "destructive"
                    : "default"
                }
              >
                {blockState.kind === "checking-capability" ||
                blockState.kind === "loading-models" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>{blockState.title}</AlertTitle>
                <AlertDescription>{blockState.description}</AlertDescription>
              </Alert>
            </div>
          ) : null}
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
            canSubmit={blockState === null}
            blockedSendMessage={blockState?.description ?? null}
            onBlockedSend={() => {
              if (blockState?.kind === "missing-settings") {
                setIsSettingsOpen(true);
              }
              if (blockState) {
                toast("Cannot send request", {
                  description: blockState.description,
                });
              }
            }}
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
