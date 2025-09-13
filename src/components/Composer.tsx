import { Send, Settings } from "lucide-react";
import type React from "react";
import { useState, useRef, forwardRef, useImperativeHandle } from "react";

import { ParametersDrawer } from "./ParametersDrawer";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RunParameters } from "@/types/logprob";

interface ComposerProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  parameters: RunParameters;
  onParametersChange: (params: RunParameters) => void;
  showWhitespaceOverlays?: boolean;
  showPunctuationOverlays?: boolean;
  onReadabilityChange?: (patch: {
    showWhitespace?: boolean;
    showPunctuation?: boolean;
  }) => void;
}

export interface ComposerHandle {
  focus: () => void;
  openParameters: () => void;
  setMessage: (value: string) => void;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(
  function Composer(
    {
      onSendMessage,
      isLoading,
      parameters,
      onParametersChange,
      showWhitespaceOverlays = true,
      showPunctuationOverlays = true,
      onReadabilityChange,
    }: ComposerProps,
    ref
  ) {
    const [message, setMessage] = useState("");
    const [showParameters, setShowParameters] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          textareaRef.current?.focus();
        },
        openParameters: () => setShowParameters(true),
        setMessage: (value: string) => {
          setMessage(value);
          const ta = textareaRef.current;
          if (ta) {
            ta.style.height = "auto";
            ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
          }
        },
      }),
      []
    );

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      submitMessage();
    };

    const submitMessage = () => {
      if (!message.trim() || isLoading) return;
      onSendMessage(message);
      setMessage("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submitMessage();
      }
    };

    const handleTextareaChange = (
      e: React.ChangeEvent<HTMLTextAreaElement>
    ) => {
      setMessage(e.target.value);

      // Auto-resize textarea
      const textarea = e.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    };

    return (
      <div className="border-t bg-background">
        <div className="px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Branch context info removed per UX simplification */}

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder={"Type your message... (Cmd/Ctrl+Enter to send)"}
                  disabled={isLoading}
                  className="min-h-[44px] max-h-[200px] resize-none pr-12"
                  rows={1}
                />
              </div>

              <div className="flex gap-1">
                <Button
                  type="submit"
                  disabled={!message.trim() || isLoading}
                  className="h-11 px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowParameters(!showParameters)}
                  className="h-11 w-11"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>Cmd/Ctrl+Enter to send</div>
              <div>Max tokens: {parameters.max_tokens}</div>
            </div>
          </form>
        </div>

        <ParametersDrawer
          isOpen={showParameters}
          onClose={() => setShowParameters(false)}
          parameters={parameters}
          onParametersChange={onParametersChange}
          showWhitespaceOverlays={showWhitespaceOverlays}
          showPunctuationOverlays={showPunctuationOverlays}
          onReadabilityChange={onReadabilityChange}
        />
      </div>
    );
  }
);
