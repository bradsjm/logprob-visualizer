import { Loader2, RotateCcw } from "lucide-react";
import { useStickToBottom } from "use-stick-to-bottom";
import type { StickToBottomInstance } from "use-stick-to-bottom";

import { TokenText } from "./TokenText";

import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/types/logprob";

interface ChatTranscriptProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onTokenClick: (tokenIndex: number, newToken: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
  regenerableMessageId?: string | null;
  isRegenerateDisabled?: boolean;
  activeCompletionMessageId: string | null;
  showWhitespaceOverlays?: boolean;
  showPunctuationOverlays?: boolean;
}

type ScrollContainerRef = StickToBottomInstance["scrollRef"];

interface AssistantTokensProps {
  readonly tokens: NonNullable<ChatMessage["tokens"]>;
  readonly onTokenClick: (tokenIndex: number, newToken: string) => void;
  readonly tokenScopeId: string;
  readonly isInteractive: boolean;
  readonly showWhitespaceOverlays: boolean;
  readonly showPunctuationOverlays: boolean;
  readonly scrollContainerRef: ScrollContainerRef;
}

const AssistantTokens = ({
  tokens,
  onTokenClick,
  tokenScopeId,
  isInteractive,
  showWhitespaceOverlays,
  showPunctuationOverlays,
  scrollContainerRef,
}: AssistantTokensProps) => {
  return (
    <TokenText
      tokens={tokens}
      onTokenClick={onTokenClick}
      tokenScopeId={tokenScopeId}
      isInteractive={isInteractive}
      showWhitespaceOverlays={showWhitespaceOverlays}
      showPunctuationOverlays={showPunctuationOverlays}
      scrollContainerRef={scrollContainerRef}
    />
  );
};

/**
 * Displays the conversation history with streaming assistant tokens and progressive scrolling.
 */
export const ChatTranscript = ({
  messages,
  isLoading,
  onTokenClick,
  onRegenerateMessage,
  regenerableMessageId = null,
  isRegenerateDisabled = false,
  activeCompletionMessageId,
  showWhitespaceOverlays = false,
  showPunctuationOverlays = false,
}: ChatTranscriptProps) => {
  const { scrollRef, contentRef } = useStickToBottom();

  // Consider any trailing assistant message (text-only or tokenized) as an active stream panel.
  // This prevents showing a second placeholder panel during streaming when tokens arrive.
  const hasStreamingAssistant =
    messages.length > 0 && messages[messages.length - 1]?.role === "assistant";

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 transcript-scroll">
      <div ref={contentRef} className="space-y-6">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-2">Start exploring token probabilities</p>
              <p className="text-sm">
                Type a message below to see how the model generates tokens
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="flex">
            {message.role === "user" ? (
              <div className="chat-bubble-user">
                <p className="text-sm font-medium text-secondary-foreground mb-1">You</p>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : (
              <div className="chat-bubble-assistant group relative pr-12">
                {message.id === regenerableMessageId && onRegenerateMessage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-8 w-8 rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="Regenerate response"
                    disabled={isRegenerateDisabled}
                    onClick={() => onRegenerateMessage(message.id)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                ) : null}
                <p className="text-sm font-medium text-card-foreground mb-2">Assistant</p>
                {message.tokens ? (
                  <AssistantTokens
                    tokens={message.tokens}
                    onTokenClick={onTokenClick}
                    tokenScopeId={message.id}
                    isInteractive={message.id === activeCompletionMessageId}
                    showWhitespaceOverlays={showWhitespaceOverlays}
                    showPunctuationOverlays={showPunctuationOverlays}
                    scrollContainerRef={scrollRef}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && !hasStreamingAssistant && (
          <div className="chat-bubble-assistant">
            <p className="text-sm font-medium text-card-foreground mb-2">Assistant</p>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating response...</span>
            </div>
          </div>
        )}

        {/* End of transcript */}
        <div aria-hidden />
      </div>
    </div>
  );
};
