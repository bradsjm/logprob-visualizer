import type React from "react";
import { useRef, useState } from "react";

import { TokenTooltip } from "./TokenTooltip";

import {
  isPunctuationToken,
  isWhitespaceToken,
  formatProbabilityPercent,
  getTokenColorClass,
} from "@/lib/utils";
import type { TokenLP } from "@/types/logprob";

interface TokenTextProps {
  tokens: TokenLP[];
  onTokenClick: (tokenIndex: number, newToken: string) => void;
  tokenScopeId: string;
  isInteractive?: boolean;
  highlightedTokenIndex?: number | null;
  showWhitespaceOverlays?: boolean;
  showPunctuationOverlays?: boolean;
}

// (moved to utils)

/**
 * Renders token spans with probabilistic styling and progressive virtualization of large completions.
 */
export const TokenText = ({
  tokens,
  onTokenClick,
  tokenScopeId,
  isInteractive = true,
  highlightedTokenIndex = null,
  showWhitespaceOverlays = false,
  showPunctuationOverlays = false,
}: TokenTextProps) => {
  const [pinnedTooltip, setPinnedTooltip] = useState<number | null>(null);
  const [hoveredToken, setHoveredToken] = useState<number | null>(null);
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const handleTokenClick = (tokenIndex: number, token: string) => {
    if (pinnedTooltip === tokenIndex) {
      setPinnedTooltip(null);
    } else {
      setPinnedTooltip(tokenIndex);
    }
    onTokenClick(tokenIndex, token);
  };

  const handleTokenKeyDown = (
    e: React.KeyboardEvent,
    tokenIndex: number,
    token: string,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleTokenClick(tokenIndex, token);
    } else if (e.key === "Escape") {
      setPinnedTooltip(null);
    }
  };

  return (
    <div className="relative leading-relaxed" aria-live="polite">
      {tokens.map((token) => {
        const tokenIndex = token.index;
        const tokenIsWhitespace = isWhitespaceToken(token.token);
        const tokenIsPunct = isPunctuationToken(token.token);

        let colorClass: string = getTokenColorClass(token.prob);
        let isLowProb = token.prob < 0.5; // Show dashed underline for low probability

        if (
          (!showWhitespaceOverlays && tokenIsWhitespace) ||
          (!showPunctuationOverlays && tokenIsPunct)
        ) {
          colorClass = "";
          isLowProb = false;
        }
        const showTooltip =
          isInteractive &&
          (hoveredToken === tokenIndex || pinnedTooltip === tokenIndex);
        const tooltipId = `tooltip-${tokenScopeId}-${tokenIndex}`;

        return (
          <span key={tokenIndex} className="relative">
            <span
              ref={(el) => {
                spanRefs.current[tokenIndex] = el;
              }}
              data-token-index={tokenIndex}
              data-token-scope={tokenScopeId}
              className={`token-span ${colorClass} ${highlightedTokenIndex === tokenIndex ? "token-highlighted" : ""} ${!colorClass ? "" : isLowProb ? "border-b-2 border-dashed border-current" : "border-b-2 border-transparent"}`}
              role={isInteractive ? "button" : undefined}
              aria-pressed={isInteractive && pinnedTooltip === tokenIndex ? true : undefined}
              tabIndex={isInteractive ? 0 : undefined}
              aria-describedby={showTooltip ? tooltipId : undefined}
              aria-label={`Token ${JSON.stringify(token.token)}, probability ${formatProbabilityPercent(token.prob, 1)}`}
              onMouseEnter={() => {
                if (isInteractive) setHoveredToken(tokenIndex);
              }}
              onMouseLeave={() => {
                if (isInteractive) setHoveredToken(null);
              }}
              onClick={() => {
                if (isInteractive) handleTokenClick(tokenIndex, token.token);
              }}
              onKeyDown={(e) => {
                if (isInteractive) handleTokenKeyDown(e, tokenIndex, token.token);
              }}
            >
              {token.token}
            </span>

            {showTooltip && (
              <TokenTooltip
                token={token}
                tooltipId={tooltipId}
                onAlternativeClick={(altToken) => onTokenClick(tokenIndex, altToken)}
                onClose={() => {
                  setPinnedTooltip(null);
                  setHoveredToken(null);
                }}
                isPinned={pinnedTooltip === tokenIndex}
                anchorEl={spanRefs.current[tokenIndex]}
              />
            )}
          </span>
        );
      })}
    </div>
  );
};
