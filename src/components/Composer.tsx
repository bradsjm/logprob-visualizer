import { Send, Settings } from "lucide-react";
import { useState, useRef } from "react";

import { ParametersDrawer } from "./ParametersDrawer";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BranchContext, RunParameters } from "@/types/logprob";

interface ComposerProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  branchContext: BranchContext | null;
  parameters: RunParameters;
  onParametersChange: (params: RunParameters) => void;
}

export const Composer = ({ 
  onSendMessage, 
  isLoading, 
  branchContext,
  parameters,
  onParametersChange 
}: ComposerProps) => {
  const [message, setMessage] = useState("");
  const [showParameters, setShowParameters] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
          {/* Branch context info */}
          {branchContext && (
            <div className="text-sm text-muted-foreground bg-surface p-3 rounded-lg">
              Continuing from: <code className="bg-muted px-1 rounded">"{branchContext.prefix}"</code>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={branchContext ? 
                  "Continue the conversation from the branch..." : 
                  "Type your message... (Cmd/Ctrl+Enter to send)"
                }
                disabled={isLoading}
                className="min-h-[44px] max-h-[200px] resize-none pr-12"
                rows={1}
              />
            </div>
            
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowParameters(!showParameters)}
                className="h-11 w-11"
              >
                <Settings className="h-4 w-4" />
              </Button>
              
              <Button
                type="submit"
                disabled={!message.trim() || isLoading}
                className="h-11 px-4"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              {branchContext ? 
                "Branching enabled - new completion will continue from selected token" :
                "Cmd/Ctrl+Enter to send"
              }
            </div>
            <div>
              Max tokens: {parameters.max_tokens}
            </div>
          </div>
        </form>
      </div>

      <ParametersDrawer
        isOpen={showParameters}
        onClose={() => setShowParameters(false)}
        parameters={parameters}
        onParametersChange={onParametersChange}
      />
    </div>
  );
};
