import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import type { TokenLP } from "@/types/logprob";
import { getTokenColorClass, tokenColorToTextClass } from "@/lib/utils";

interface TokenTooltipProps {
  token: TokenLP;
  onAlternativeClick: (altToken: string) => void;
  onClose: () => void;
  isPinned: boolean;
  min?: number;
  max?: number;
  anchorEl?: HTMLElement | null;
}

export const TokenTooltip = ({ 
  token, 
  onAlternativeClick, 
  onClose, 
  isPinned,
  min,
  max,
  anchorEl,
}: TokenTooltipProps) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);

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
  const tokenClass = (min !== undefined && max !== undefined)
    ? tokenColorToTextClass(getTokenColorClass(token.logprob, min, max))
    : "";

  // Edge-aware initial positioning (no snapping): measure and clamp to viewport
  useLayoutEffect(() => {
    const reposition = () => {
      if (!anchorEl || !tooltipRef.current) return;
      const margin = 8;
      const rect = anchorEl.getBoundingClientRect();
      const tEl = tooltipRef.current;
      // Prepare for measurement
      tEl.style.visibility = "hidden";
      tEl.style.position = "fixed";
      tEl.style.top = "0px";
      tEl.style.left = "0px";
      const tWidth = tEl.offsetWidth;
      const tHeight = tEl.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Horizontal center, clamped to viewport margins
      let left = rect.left + rect.width / 2 - tWidth / 2;
      left = Math.max(margin, Math.min(left, vw - tWidth - margin));

      // Prefer below; if not enough space, flip above; finally clamp to viewport
      const belowTop = rect.bottom + 8;
      const aboveTop = rect.top - tHeight - 8;
      let top = belowTop;
      if (belowTop + tHeight + margin > vh && aboveTop >= margin) {
        top = aboveTop; // flip above
      } else if (belowTop + tHeight + margin > vh) {
        // Not enough room either way; clamp inside viewport
        top = Math.max(margin, Math.min(belowTop, vh - tHeight - margin));
      }

      setCoords({ top, left });
      setVisible(true);
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [anchorEl, token.index, token.logprob, min, max]);

  const body = document.body;
  const content = (
    <div
      ref={tooltipRef}
      id={`tooltip-${token.index}`}
      role="dialog"
      aria-label={`Token probabilities for ${token.token}`}
      className="z-50 p-4 bg-popover border rounded-lg shadow-lg min-w-64 max-w-80 scale-in"
      style={{
        position: "fixed",
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        visibility: visible ? "visible" : "hidden",
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
            Token: <code className={`px-1 py-0.5 bg-muted rounded text-sm font-mono ${tokenClass}`}>"{token.token}"</code>
          </div>
          <div className="text-sm text-muted-foreground">
            Probability: <span className={`font-medium ${tokenClass}`}>{formatPercent(token.prob)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Log probability: <span className={`font-medium ${tokenClass}`}>{token.logprob.toFixed(3)}</span>
          </div>
        </div>

        {/* Top alternatives */}
        {token.top_logprobs && token.top_logprobs.length > 1 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-popover-foreground">
              Top alternatives:
            </div>
            <div className="space-y-1">
              {token.top_logprobs.slice(0, 5).map((alt, index) => {
                const altClass = (min !== undefined && max !== undefined)
                  ? tokenColorToTextClass(getTokenColorClass(alt.logprob, min, max))
                  : "";
                return (
                <button
                  key={index}
                  onClick={() => onAlternativeClick(alt.token)}
                  className="w-full text-left p-2 rounded hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <code className={`text-sm font-mono group-hover:text-accent-foreground ${altClass}`}>
                      "{alt.token}"
                    </code>
                    <span className={`text-sm text-muted-foreground group-hover:text-accent-foreground ${altClass}`}>
                      {formatPercent(alt.prob)}
                    </span>
                  </div>
                </button>
              );})}
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

  return createPortal(content, body);
};
