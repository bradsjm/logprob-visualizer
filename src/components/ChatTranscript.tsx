import { Loader2 } from "lucide-react";
import { useRef, useEffect } from "react";

import { TokenText } from "./TokenText";
import { calculateQuantiles } from "@/lib/utils";

import type { ChatMessage, CompletionLP } from "@/types/logprob";

interface ChatTranscriptProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onTokenClick: (tokenIndex: number, newToken: string) => void;
  currentCompletion: CompletionLP | null;
  showWhitespaceOverlays?: boolean;
  showPunctuationOverlays?: boolean;
}

interface AssistantTokensProps {
  readonly tokens: NonNullable<ChatMessage["tokens"]>;
  readonly onTokenClick: (tokenIndex: number, newToken: string) => void;
  readonly showWhitespaceOverlays: boolean;
  readonly showPunctuationOverlays: boolean;
  readonly scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const AssistantTokens = ({
  tokens,
  onTokenClick,
  showWhitespaceOverlays,
  showPunctuationOverlays,
  scrollContainerRef,
}: AssistantTokensProps) => {
  // Keep color scale stable across progressive rendering by using global quantiles.
  const q = calculateQuantiles(tokens);
  return (
    <TokenText
      tokens={tokens}
      onTokenClick={onTokenClick}
      showWhitespaceOverlays={showWhitespaceOverlays}
      showPunctuationOverlays={showPunctuationOverlays}
      scrollContainerRef={
        scrollContainerRef as unknown as React.RefObject<HTMLElement>
      }
      quantiles={q}
    />
  );
};

export const ChatTranscript = ({
  messages,
  isLoading,
  onTokenClick,
  currentCompletion: _currentCompletion,
  showWhitespaceOverlays = true,
  showPunctuationOverlays = true,
}: ChatTranscriptProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-6 py-4 space-y-6 transcript-scroll"
    >
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

      {messages.map((message, index) => (
        <div key={index} className="flex">
          {message.role === "user" ? (
            <div className="chat-bubble-user">
              <p className="text-sm font-medium text-secondary-foreground mb-1">
                You
              </p>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ) : (
            <div className="chat-bubble-assistant">
              <p className="text-sm font-medium text-card-foreground mb-2">
                Assistant
              </p>
              {message.tokens ? (
                <AssistantTokens
                  tokens={message.tokens}
                  onTokenClick={onTokenClick}
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

      {isLoading && (
        <div className="chat-bubble-assistant">
          <p className="text-sm font-medium text-card-foreground mb-2">
            Assistant
          </p>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Generating response...</span>
          </div>
        </div>
      )}
    </div>
  );
};
