import type React from "react";
import { useRef, useState, useMemo } from "react";

import { TokenTooltip } from "./TokenTooltip";

import type { TokenLP } from "@/types/logprob";
import { isPunctuationToken, isWhitespaceToken, calculateQuantiles, getTokenColorClass } from "@/lib/utils";

interface TokenTextProps {
  tokens: TokenLP[];
  onTokenClick: (tokenIndex: number, newToken: string) => void;
  showWhitespaceOverlays?: boolean;
  showPunctuationOverlays?: boolean;
}

// (moved to utils)

export const TokenText = ({ tokens, onTokenClick, showWhitespaceOverlays = true, showPunctuationOverlays = true }: TokenTextProps) => {
  const [pinnedTooltip, setPinnedTooltip] = useState<number | null>(null);
  const [hoveredToken, setHoveredToken] = useState<number | null>(null);
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const { min, max } = useMemo(() => calculateQuantiles(tokens), [tokens]);

  const handleTokenClick = (tokenIndex: number, token: string) => {
    if (pinnedTooltip === tokenIndex) {
      setPinnedTooltip(null);
    } else {
      setPinnedTooltip(tokenIndex);
    }
    onTokenClick(tokenIndex, token);
  };

  const handleTokenKeyDown = (e: React.KeyboardEvent, tokenIndex: number, token: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleTokenClick(tokenIndex, token);
    } else if (e.key === "Escape") {
      setPinnedTooltip(null);
    }
  };

  return (
    <div className="relative leading-relaxed">
      {tokens.map((token, index) => {
        const tokenIsWhitespace = isWhitespaceToken(token.token);
        const tokenIsPunct = isPunctuationToken(token.token);

        let colorClass: string = getTokenColorClass(token.logprob, min, max);
        let isLowProb = token.prob < 0.5; // Show dashed underline for low probability

        if ((!showWhitespaceOverlays && tokenIsWhitespace) || (!showPunctuationOverlays && tokenIsPunct)) {
          colorClass = "";
          isLowProb = false;
        }
        const showTooltip = hoveredToken === index || pinnedTooltip === index;

        return (
          <span key={index} className="relative">
            <span
              ref={(el) => { spanRefs.current[index] = el; }}
              data-token-index={index}
              className={`token-span ${colorClass} ${isLowProb ? 'border-b-2 border-dashed' : ''}`}
              role="button"
              aria-pressed={pinnedTooltip === index || undefined}
              tabIndex={0}
              aria-describedby={showTooltip ? `tooltip-${index}` : undefined}
              onMouseEnter={() => setHoveredToken(index)}
              onMouseLeave={() => setHoveredToken(null)}
              onClick={() => handleTokenClick(index, token.token)}
              onKeyDown={(e) => handleTokenKeyDown(e, index, token.token)}
            >
              {token.token}
            </span>
            
            {showTooltip && (
              <TokenTooltip
                token={token}
                onAlternativeClick={(altToken) => onTokenClick(index, altToken)}
                onClose={() => {
                  setPinnedTooltip(null);
                  setHoveredToken(null);
                }}
                isPinned={pinnedTooltip === index}
                min={min}
                max={max}
                anchorEl={spanRefs.current[index]}
              />
            )}
          </span>
        );
      })}
    </div>
  );
};
