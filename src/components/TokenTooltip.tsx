import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { TokenLP } from "@/types/logprob";

interface TokenTooltipProps {
  token: TokenLP;
  onAlternativeClick: (altToken: string) => void;
  onClose: () => void;
  isPinned: boolean;
}

export const TokenTooltip = ({ 
  token, 
  onAlternativeClick, 
  onClose, 
  isPinned 
}: TokenTooltipProps) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (isPinned && tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isPinned) {
      document.addEventListener("keydown", handleEscape);
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPinned, onClose]);

  const formatPercent = (prob: number) => `${(prob * 100).toFixed(2)}%`;

  return (
    <div
      ref={tooltipRef}
      id={`tooltip-${token.index}`}
      role="dialog"
      aria-label={`Token probabilities for ${token.token}`}
      className="absolute z-50 mt-2 p-4 bg-popover border rounded-lg shadow-lg min-w-64 max-w-80 scale-in"
      style={{
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      {isPinned && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0"
          onClick={onClose}
          aria-label="Close tooltip"
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      <div className="space-y-3">
        {/* Current token info */}
        <div className="space-y-1">
          <div className="font-medium text-popover-foreground">
            Token: <code className="px-1 py-0.5 bg-muted rounded text-sm font-mono">"{token.token}"</code>
          </div>
          <div className="text-sm text-muted-foreground">
            Probability: <span className="font-medium">{formatPercent(token.prob)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Log probability: <span className="font-medium">{token.logprob.toFixed(3)}</span>
          </div>
        </div>

        {/* Top alternatives */}
        {token.top_logprobs && token.top_logprobs.length > 1 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-popover-foreground">
              Top alternatives:
            </div>
            <div className="space-y-1">
              {token.top_logprobs.slice(0, 5).map((alt, index) => (
                <button
                  key={index}
                  onClick={() => onAlternativeClick(alt.token)}
                  className="w-full text-left p-2 rounded hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono group-hover:text-accent-foreground">
                      "{alt.token}"
                    </code>
                    <span className="text-sm text-muted-foreground group-hover:text-accent-foreground">
                      {formatPercent(alt.prob)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            
            {token.top_logprobs.length > 5 && (
              <div className="text-xs text-muted-foreground text-center pt-1 border-t">
                Showing top 5 of {token.top_logprobs.length} alternatives
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};