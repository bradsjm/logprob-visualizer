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

function buildTokenSelector(scopeId: string, tokenIndex: number): string {
  return `[data-token-scope="${scopeId}"][data-token-index="${tokenIndex}"]`;
}

function replaceMessage(
  messages: readonly ChatMessage[],
  messageId: string,
  nextMessage: ChatMessage,
): ChatMessage[] {
  const nextIndex = messages.findIndex((message) => message.id === messageId);
  if (nextIndex === -1) {
    return [...messages];
  }

  const nextMessages = [...messages];
  nextMessages[nextIndex] = nextMessage;
  return nextMessages;
}

function removeMessage(
  messages: readonly ChatMessage[],
  messageId: string,
): ChatMessage[] {
  return messages.filter((message) => message.id !== messageId);
}

interface AnalysisSnapshot {
  readonly completion: CompletionLP;
  readonly activeCompletionMessageId: string;
  readonly lastLowIndex: number | null;
}

interface AssistantRunSpec {
  readonly requestMessages: readonly ChatMessage[];
  readonly assistantMessageId: string;
  readonly commitOptimisticMessages: (
    messages: readonly ChatMessage[],
  ) => ChatMessage[];
  readonly handleFailedMessages: (
    messages: readonly ChatMessage[],
  ) => ChatMessage[];
  readonly analysisSnapshot: AnalysisSnapshot | null;
  readonly startAnnouncement: string;
  readonly failureAnnouncement: string;
  readonly cancellationAnnouncement: string;
}

function getLatestRegenerableAssistantContext(
  messages: readonly ChatMessage[],
):
  | {
    readonly assistantIndex: number;
    readonly assistantMessage: ChatMessage;
    readonly requestMessages: readonly ChatMessage[];
  }
  | null {
  if (messages.length < 2) {
    return null;
  }

  const assistantIndex = messages.length - 1;
  const assistantMessage = messages[assistantIndex];
  const precedingMessage = messages[assistantIndex - 1];

  if (
    !assistantMessage ||
    assistantMessage.role !== "assistant" ||
    !precedingMessage ||
    precedingMessage.role !== "user"
  ) {
    return null;
  }

  return {
    assistantIndex,
    assistantMessage,
    requestMessages: messages.slice(0, assistantIndex),
  };
}

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
  const [currentCompletion, setCurrentCompletion] =
    useState<CompletionLP | null>(null);
  const [activeCompletionMessageId, setActiveCompletionMessageId] =
    useState<string | null>(null);
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
  const activeStreamRef = useRef<Stream<StreamEvent> | null>(null);
  const activeRunIdRef = useRef<number | null>(null);
  const runSequenceRef = useRef(0);
  const messageSequenceRef = useRef(0);
  const cancelRequestedRef = useRef(false);
  const [showWhitespaceOverlays, setShowWhitespaceOverlays] = useState(false);
  const [showPunctuationOverlays, setShowPunctuationOverlays] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [lastLowIndex, setLastLowIndex] = useState<number | null>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const [isChartPending, startChartTransition] = useTransition();
  const deferredCompletion = useDeferredValue(currentCompletion);
  const lastHoverRef = useRef<number | null>(null);

  const nextMessageId = (): string => {
    messageSequenceRef.current += 1;
    return `message-${messageSequenceRef.current}`;
  };

  const clearHoveredToken = () => {
    const previousTokenIndex = lastHoverRef.current;
    if (
      typeof previousTokenIndex === "number" &&
      activeCompletionMessageId !== null
    ) {
      const previousElement = document.querySelector(
        buildTokenSelector(activeCompletionMessageId, previousTokenIndex),
      );
      previousElement?.classList.remove("token-chart-hover");
    }
    lastHoverRef.current = null;
  };

  const resetAnalysisState = () => {
    clearHoveredToken();
    setCurrentCompletion(null);
    setActiveCompletionMessageId(null);
    setLastLowIndex(null);
  };

  const abortActiveStream = (markCanceled: boolean) => {
    if (markCanceled) {
      cancelRequestedRef.current = true;
    }

    activeRunIdRef.current = null;
    const stream = activeStreamRef.current;
    activeStreamRef.current = null;
    setActiveStream(null);
    stream?.abort();
  };

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

  const capabilityNotice = useMemo(() => {
    if (capability.status !== "unknown-transient") {
      return null;
    }

    return {
      title: "Unable to verify logprobs support",
      description:
        capability.message ??
        "Capability probing failed. You can still try a generation request.",
    };
  }, [capability.message, capability.status]);

  const regenerableAssistant = useMemo(
    () => getLatestRegenerableAssistantContext(messages),
    [messages],
  );

  const restoreAnalysisSnapshot = (snapshot: AnalysisSnapshot | null) => {
    clearHoveredToken();
    if (!snapshot) {
      resetAnalysisState();
      return;
    }

    setCurrentCompletion(snapshot.completion);
    setActiveCompletionMessageId(snapshot.activeCompletionMessageId);
    setLastLowIndex(snapshot.lastLowIndex);
  };

  const buildAnalysisSnapshot = (
    messageId: string,
  ): AnalysisSnapshot | null => {
    if (!currentCompletion || activeCompletionMessageId !== messageId) {
      return null;
    }

    return {
      completion: currentCompletion,
      activeCompletionMessageId,
      lastLowIndex,
    };
  };

  const runAssistantCompletion = async ({
    requestMessages,
    assistantMessageId,
    commitOptimisticMessages,
    handleFailedMessages,
    analysisSnapshot,
    startAnnouncement,
    failureAnnouncement,
    cancellationAnnouncement,
  }: AssistantRunSpec) => {
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

    abortActiveStream(false);
    resetAnalysisState();
    setMessages((prev) => commitOptimisticMessages(prev));

    const runId = runSequenceRef.current + 1;
    runSequenceRef.current = runId;
    setIsLoading(true);
    setLiveMessage(startAnnouncement);

    try {
      const stream = transport.complete({
        messages: requestMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        model: selectedModel.id,
        temperature: runParameters.temperature,
        top_p: runParameters.top_p,
        presence_penalty: runParameters.presence_penalty,
        frequency_penalty: runParameters.frequency_penalty,
        max_completion_tokens: runParameters.max_completion_tokens,
        top_logprobs: runParameters.top_logprobs,
      });

      let streamText = "";
      const tokensBufferRef = { current: [] as TokenLP[] };
      let flushScheduled = false;
      let flushRaf: number | null = null;
      let haveShownTokens = false;
      let discardAssistantMessage = false;
      let requestFailureMessage: string | null = null;

      activeRunIdRef.current = runId;
      activeStreamRef.current = stream;
      setActiveStream(stream);

      const scheduleFlush = () => {
        if (flushScheduled) return;
        flushScheduled = true;
        flushRaf = requestAnimationFrame(() => {
          flushScheduled = false;
          flushRaf = null;
          if (activeRunIdRef.current !== runId) {
            return;
          }
          const buffered = tokensBufferRef.current;
          if (buffered.length === 0) return;
          setMessages((prev) => {
            const existingMessage = prev.find(
              (message) => message.id === assistantMessageId,
            );
            if (!existingMessage) return prev;
            const existingTokens = existingMessage.tokens;
            const merged = existingTokens && existingTokens.length > 0
              ? [...existingTokens, ...buffered]
              : [...buffered];
            return replaceMessage(prev, assistantMessageId, {
              id: assistantMessageId,
              role: "assistant" as const,
              content: streamText,
              tokens: merged,
            });
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

      try {
        for await (const evt of stream) {
          if (activeRunIdRef.current !== runId) {
            continue;
          }

          if (evt.type === "delta") {
            streamText += evt.delta;
            if (!haveShownTokens) {
              setMessages((prev) => {
                const existingMessage = prev.find(
                  (message) => message.id === assistantMessageId,
                );
                if (!existingMessage) return prev;
                return replaceMessage(prev, assistantMessageId, {
                  id: assistantMessageId,
                  role: "assistant" as const,
                  content: streamText,
                });
              });
            }
            setLiveMessage("Streaming response…");
          } else if (evt.type === "logprobs") {
            tokensBufferRef.current.push(evt.delta);
            scheduleFlush();
          } else if (evt.type === "done") {
            cancelPendingFlush();
            if (evt.error) {
              discardAssistantMessage = true;
              requestFailureMessage = evt.error;
              restoreAnalysisSnapshot(analysisSnapshot);
              setLiveMessage(failureAnnouncement);
              continue;
            }

            const finalText = evt.completion?.text ?? streamText;
            setMessages((prev) => {
              const existingMessage = prev.find(
                (message) => message.id === assistantMessageId,
              );
              if (!existingMessage) return prev;
              return replaceMessage(prev, assistantMessageId, {
                id: assistantMessageId,
                role: "assistant" as const,
                content: finalText,
                tokens: evt.completion?.tokens,
              });
            });
            if (evt.completion) {
              const completion = evt.completion;
              startChartTransition(() => {
                setCurrentCompletion(completion);
                setActiveCompletionMessageId(assistantMessageId);
              });
            } else {
              setLiveMessage("Response complete (no chart data)");
            }
          }
        }
      } catch (err) {
        const name = (err as { name?: string } | null)?.name;
        if (name === "AbortError" || cancelRequestedRef.current) {
          discardAssistantMessage = true;
          restoreAnalysisSnapshot(analysisSnapshot);
          setLiveMessage(cancellationAnnouncement);
        } else {
          throw err;
        }
      } finally {
        cancelPendingFlush();
        if (discardAssistantMessage) {
          setMessages((prev) => handleFailedMessages(prev));
          if (requestFailureMessage) {
            toast("Request failed", { description: requestFailureMessage });
            composerRef.current?.focus();
          }
        }
        if (activeRunIdRef.current === runId) {
          activeRunIdRef.current = null;
          activeStreamRef.current = null;
          setActiveStream(null);
        }
        cancelRequestedRef.current = false;
      }
    } catch (error) {
      restoreAnalysisSnapshot(analysisSnapshot);
      const message = (error as Error).message;
      setMessages((prev) => handleFailedMessages(prev));
      console.error("Error generating response:", message);
      toast("Request failed", { description: message });
      setLiveMessage(failureAnnouncement);
      composerRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;
    const userMessage = { id: nextMessageId(), role: "user" as const, content };
    const assistantMessageId = nextMessageId();
    const assistantMessage = {
      id: assistantMessageId,
      role: "assistant" as const,
      content: "",
    };
    const requestMessages = [...messages, userMessage];

    await runAssistantCompletion({
      requestMessages,
      assistantMessageId,
      commitOptimisticMessages: (existingMessages) => [
        ...existingMessages,
        userMessage,
        assistantMessage,
      ],
      handleFailedMessages: (existingMessages) =>
        removeMessage(existingMessages, assistantMessageId),
      analysisSnapshot: null,
      startAnnouncement: "Sending request...",
      failureAnnouncement: "Request failed. Focus returned to composer.",
      cancellationAnnouncement: "Streaming canceled",
    });
  };

  const handleRegenerateMessage = async (messageId: string) => {
    const context = regenerableAssistant;
    if (!context || context.assistantMessage.id !== messageId) {
      return;
    }

    const emptyAssistantMessage: ChatMessage = {
      id: context.assistantMessage.id,
      role: "assistant",
      content: "",
    };
    const analysisSnapshot = buildAnalysisSnapshot(context.assistantMessage.id);

    await runAssistantCompletion({
      requestMessages: context.requestMessages,
      assistantMessageId: context.assistantMessage.id,
      commitOptimisticMessages: (existingMessages) =>
        replaceMessage(
          existingMessages,
          context.assistantMessage.id,
          emptyAssistantMessage,
        ),
      handleFailedMessages: (existingMessages) =>
        replaceMessage(
          existingMessages,
          context.assistantMessage.id,
          context.assistantMessage,
        ),
      analysisSnapshot,
      startAnnouncement: "Regenerating response…",
      failureAnnouncement: "Regeneration failed. Previous response restored.",
      cancellationAnnouncement: "Regeneration canceled. Previous response restored.",
    });
  };

  const handleBranch = (tokenIndex: number, newToken: string) => {
    if (!currentCompletion || activeCompletionMessageId === null) return;

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
        if (!currentCompletion || activeCompletionMessageId === null) return;
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
          const el = document.querySelector(
            buildTokenSelector(activeCompletionMessageId, next),
          );
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          (el as HTMLElement | null)?.focus?.();
          setLiveMessage(`Jumped to low-confidence token ${next}`);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeCompletionMessageId, currentCompletion, lastLowIndex]);

  const handleChartHover = (tokenIndex: number | null) => {
    if (activeCompletionMessageId === null) {
      clearHoveredToken();
      return;
    }

    const previousTokenIndex = lastHoverRef.current;
    if (typeof previousTokenIndex === "number") {
      const previousElement = document.querySelector(
        buildTokenSelector(activeCompletionMessageId, previousTokenIndex),
      );
      previousElement?.classList.remove("token-chart-hover");
    }
    lastHoverRef.current = tokenIndex;
    if (typeof tokenIndex === "number") {
      const tokenElement = document.querySelector(
        buildTokenSelector(activeCompletionMessageId, tokenIndex),
      );
      tokenElement?.classList.add("token-chart-hover");
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
          abortActiveStream(true);
          resetAnalysisState();
          saveSettings(nextSettings);
          toast("Connection settings saved", {
            description: "Refreshing provider models.",
          });
        }}
        onClear={() => {
          abortActiveStream(true);
          clearSettings();
          setSelectedModelId(null);
          setMessages([]);
          resetAnalysisState();
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
        <div className="flex items-center gap-4">
          <Button
            type="button"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            variant={hasSavedSettings ? "outline" : "default"}
            className="h-8 px-2 text-xs"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {hasSavedSettings ? "Connection Settings" : "Set API Key"}
          </Button>
        </div>
      </header>

      {/* Main workspace */}
      <main className="workspace-main">
        {/* Chat transcript */}
        <div className="transcript-panel">
          {blockState ?? capabilityNotice ? (
            <div className="px-6 pt-4">
              <Alert
                variant={
                  blockState?.kind === "unsupported-model" ||
                    blockState?.kind === "model-error"
                    ? "destructive"
                    : "default"
                }
              >
                {blockState?.kind === "checking-capability" ||
                  blockState?.kind === "loading-models" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>{(blockState ?? capabilityNotice)?.title}</AlertTitle>
                <AlertDescription>
                  {(blockState ?? capabilityNotice)?.description}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
          <ChatTranscript
            messages={messages}
            isLoading={isLoading}
            onTokenClick={handleBranch}
            onRegenerateMessage={handleRegenerateMessage}
            regenerableMessageId={regenerableAssistant?.assistantMessage.id ?? null}
            isRegenerateDisabled={isLoading || blockState !== null}
            activeCompletionMessageId={activeCompletionMessageId}
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
              abortActiveStream(true);
              setMessages([]);
              resetAnalysisState();
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
            if (activeCompletionMessageId === null) return;
            const tokenElement = document.querySelector(
              buildTokenSelector(activeCompletionMessageId, tokenIndex),
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
