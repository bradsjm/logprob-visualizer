import { Send, Settings, Trash2, XCircle } from "lucide-react";
import type React from "react";
import {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
} from "react";

import { ParametersDrawer } from "./ParametersDrawer";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RunParameters } from "@/types/logprob";

interface ComposerProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  isStreaming?: boolean;
  onCancel?: () => void;
  parameters: RunParameters;
  onParametersChange: (params: RunParameters) => void;
  showWhitespaceOverlays?: boolean;
  showPunctuationOverlays?: boolean;
  onReadabilityChange?: (patch: {
    showWhitespace?: boolean;
    showPunctuation?: boolean;
  }) => void;
  onClearHistory?: () => void;
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
      isStreaming = false,
      onCancel,
      parameters,
      onParametersChange,
      showWhitespaceOverlays = true,
      showPunctuationOverlays = true,
      onReadabilityChange,
      onClearHistory,
    }: ComposerProps,
    ref,
  ) {
    const [message, setMessage] = useState("");
    const [showParameters, setShowParameters] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [atMaxHeight, setAtMaxHeight] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          textareaRef.current?.focus();
        },
        openParameters: () => setShowParameters(true),
        setMessage: (value: string) => {
          // Only update state; height adjusts in a layout effect after DOM updates
          setMessage(value);
        },
      }),
      [],
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
      e: React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
      setMessage(e.target.value);

      // Height adjustment handled centrally in layout effect
    };

    // Centralized auto-resize whenever message changes (typing or programmatic setMessage)
    useLayoutEffect(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.style.height = "auto";
      const clamped = Math.min(ta.scrollHeight, 200);
      ta.style.height = `${clamped}px`;
      setAtMaxHeight(ta.scrollHeight >= 200);
    }, [message]);

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
                  className={`composer-textarea min-h-[44px] max-h-[200px] pr-12 ${atMaxHeight ? "overflow-y-auto" : "overflow-hidden"}`}
                  rows={1}
                />
              </div>

              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    {isStreaming ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => onCancel?.()}
                        className="h-11 px-4"
                        aria-label="Cancel streaming"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={!message.trim() || isLoading}
                        className="h-11 px-4"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {isStreaming ? "Cancel" : "Send (Cmd/Ctrl+Enter)"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => {
                        if (!onClearHistory) return;
                        const ok = window.confirm(
                          "Clear conversation history?",
                        );
                        if (ok) onClearHistory();
                      }}
                      aria-label="Clear conversation history"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear history</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowParameters(!showParameters)}
                      className="h-11 w-11"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Parameters</TooltipContent>
                </Tooltip>
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
  },
);
