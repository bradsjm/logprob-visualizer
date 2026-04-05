import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import type { RequestBlockState } from "@/features/playground/lib/types";
import type { RunParameters } from "@/types/logprob";
import type { ChatMessage, CompletionLP, TokenLP } from "@/types/logprob";
import type { Stream, StreamEvent, Transport } from "@/types/transport";

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

function getLatestRegenerableAssistantContext(
  messages: readonly ChatMessage[],
):
  | {
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
    assistantMessage,
    requestMessages: messages.slice(0, assistantIndex),
  };
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

export interface UsePlaygroundSessionOptions {
  readonly transport: Transport;
  readonly selectedModelId: string | null;
  readonly runParameters: Readonly<RunParameters>;
  readonly blockState: RequestBlockState | null;
  readonly onRequireSettings: () => void;
  readonly onFocusComposer: () => void;
  readonly onResetTokenNavigation: () => void;
}

export interface UsePlaygroundSessionResult {
  readonly messages: ChatMessage[];
  readonly currentCompletion: CompletionLP | null;
  readonly activeCompletionMessageId: string | null;
  readonly isLoading: boolean;
  readonly isStreaming: boolean;
  readonly liveMessage: string;
  readonly isChartPending: boolean;
  readonly regenerableMessageId: string | null;
  readonly lastLowIndex: number | null;
  readonly setLastLowIndex: (index: number | null) => void;
  readonly setLiveMessage: (message: string) => void;
  readonly sendMessage: (content: string) => Promise<void>;
  readonly regenerateMessage: (messageId: string) => Promise<void>;
  readonly cancelStream: () => void;
  readonly abortActiveStream: (markCanceled: boolean) => void;
  readonly resetAnalysisState: () => void;
  readonly clearHistory: () => void;
}

export function usePlaygroundSession({
  transport,
  selectedModelId,
  runParameters,
  blockState,
  onRequireSettings,
  onFocusComposer,
  onResetTokenNavigation,
}: UsePlaygroundSessionOptions): UsePlaygroundSessionResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentCompletion, setCurrentCompletion] =
    useState<CompletionLP | null>(null);
  const [activeCompletionMessageId, setActiveCompletionMessageId] =
    useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastLowIndex, setLastLowIndex] = useState<number | null>(null);
  const [activeStream, setActiveStream] = useState<Stream<StreamEvent> | null>(
    null,
  );
  const [liveMessage, setLiveMessage] = useState("");
  const [isChartPending, startChartTransition] = useTransition();
  const activeStreamRef = useRef<Stream<StreamEvent> | null>(null);
  const activeRunIdRef = useRef<number | null>(null);
  const runSequenceRef = useRef(0);
  const messageSequenceRef = useRef(0);
  const cancelRequestedRef = useRef(false);

  useEffect(() => {
    if (isChartPending) {
      setLiveMessage("Rendering analysis…");
    }
  }, [isChartPending]);

  useEffect(() => {
    if (!isChartPending && currentCompletion) {
      setLiveMessage("Response ready");
    }
  }, [currentCompletion, isChartPending]);

  useEffect(
    () => () => {
      activeRunIdRef.current = null;
      activeStreamRef.current?.abort();
      activeStreamRef.current = null;
    },
    [],
  );

  const resetAnalysisState = () => {
    onResetTokenNavigation();
    setLastLowIndex(null);
    setCurrentCompletion(null);
    setActiveCompletionMessageId(null);
  };

  const nextMessageId = (): string => {
    messageSequenceRef.current += 1;
    return `message-${messageSequenceRef.current}`;
  };

  const restoreAnalysisSnapshot = (snapshot: AnalysisSnapshot | null) => {
    if (!snapshot) {
      resetAnalysisState();
      return;
    }

    setLastLowIndex(snapshot.lastLowIndex);
    setCurrentCompletion(snapshot.completion);
    setActiveCompletionMessageId(snapshot.activeCompletionMessageId);
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
    if (!selectedModelId || blockState) {
      if (blockState?.kind === "missing-settings") {
        onRequireSettings();
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
        model: selectedModelId,
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
          if (buffered.length === 0) {
            return;
          }

          setMessages((prev) => {
            const existingMessage = prev.find(
              (message) => message.id === assistantMessageId,
            );
            if (!existingMessage) {
              return prev;
            }

            const mergedTokens =
              existingMessage.tokens && existingMessage.tokens.length > 0
                ? [...existingMessage.tokens, ...buffered]
                : [...buffered];

            return replaceMessage(prev, assistantMessageId, {
              id: assistantMessageId,
              role: "assistant",
              content: streamText,
              tokens: mergedTokens,
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
        for await (const event of stream) {
          if (activeRunIdRef.current !== runId) {
            continue;
          }

          if (event.type === "delta") {
            streamText += event.delta;
            if (!haveShownTokens) {
              setMessages((prev) => {
                const existingMessage = prev.find(
                  (message) => message.id === assistantMessageId,
                );
                if (!existingMessage) {
                  return prev;
                }

                return replaceMessage(prev, assistantMessageId, {
                  id: assistantMessageId,
                  role: "assistant",
                  content: streamText,
                });
              });
            }

            setLiveMessage("Streaming response…");
            continue;
          }

          if (event.type === "logprobs") {
            tokensBufferRef.current.push(event.delta);
            scheduleFlush();
            continue;
          }

          cancelPendingFlush();
          if (event.error) {
            discardAssistantMessage = true;
            requestFailureMessage = event.error;
            restoreAnalysisSnapshot(analysisSnapshot);
            setLiveMessage(failureAnnouncement);
            continue;
          }

          const finalText = event.completion?.text ?? streamText;
          setMessages((prev) => {
            const existingMessage = prev.find(
              (message) => message.id === assistantMessageId,
            );
            if (!existingMessage) {
              return prev;
            }

            return replaceMessage(prev, assistantMessageId, {
              id: assistantMessageId,
              role: "assistant",
              content: finalText,
              tokens: event.completion?.tokens,
            });
          });

          if (event.completion) {
            startChartTransition(() => {
              setCurrentCompletion(event.completion ?? null);
              setActiveCompletionMessageId(assistantMessageId);
            });
          } else {
            setLiveMessage("Response complete (no chart data)");
          }
        }
      } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        if (name === "AbortError" || cancelRequestedRef.current) {
          discardAssistantMessage = true;
          restoreAnalysisSnapshot(analysisSnapshot);
          setLiveMessage(cancellationAnnouncement);
        } else {
          throw error;
        }
      } finally {
        cancelPendingFlush();
        if (discardAssistantMessage) {
          setMessages((prev) => handleFailedMessages(prev));
          if (requestFailureMessage) {
            toast("Request failed", { description: requestFailureMessage });
            onFocusComposer();
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
      toast("Request failed", { description: message });
      setLiveMessage(failureAnnouncement);
      onFocusComposer();
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) {
      return;
    }

    const userMessage = { id: nextMessageId(), role: "user" as const, content };
    const assistantMessageId = nextMessageId();
    const assistantMessage = {
      id: assistantMessageId,
      role: "assistant" as const,
      content: "",
    };

    await runAssistantCompletion({
      requestMessages: [...messages, userMessage],
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

  const regenerateMessage = async (messageId: string) => {
    const context = getLatestRegenerableAssistantContext(messages);
    if (!context || context.assistantMessage.id !== messageId) {
      return;
    }

    const emptyAssistantMessage: ChatMessage = {
      id: context.assistantMessage.id,
      role: "assistant",
      content: "",
    };

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
      analysisSnapshot: buildAnalysisSnapshot(context.assistantMessage.id),
      startAnnouncement: "Regenerating response…",
      failureAnnouncement: "Regeneration failed. Previous response restored.",
      cancellationAnnouncement:
        "Regeneration canceled. Previous response restored.",
    });
  };

  return {
    messages,
    currentCompletion,
    activeCompletionMessageId,
    isLoading,
    isStreaming: activeStream !== null,
    liveMessage,
    isChartPending,
    regenerableMessageId:
      getLatestRegenerableAssistantContext(messages)?.assistantMessage.id ?? null,
    lastLowIndex,
    setLastLowIndex,
    setLiveMessage,
    sendMessage,
    regenerateMessage,
    cancelStream() {
      if (activeStreamRef.current) {
        cancelRequestedRef.current = true;
        activeStreamRef.current.abort();
      }
    },
    abortActiveStream,
    resetAnalysisState,
    clearHistory() {
      abortActiveStream(true);
      setMessages([]);
      resetAnalysisState();
      setLiveMessage("History cleared");
      onFocusComposer();
    },
  };
}
