import { useState, useMemo } from "react";

import { TokenTooltip } from "./TokenTooltip";

import type { TokenLP } from "@/types/logprob";

interface TokenTextProps {
  tokens: TokenLP[];
  onTokenClick: (tokenIndex: number, newToken: string) => void;
}

// Calculate probability quantiles for color mapping
const calculateQuantiles = (tokens: TokenLP[]) => {
  const logprobs = tokens.map(t => t.logprob).sort((a, b) => a - b);
  const q05 = logprobs[Math.floor(logprobs.length * 0.05)] || -10;
  const q95 = logprobs[Math.floor(logprobs.length * 0.95)] || 0;
  
  // Clamp to reasonable bounds
  const min = Math.max(q05, -20);
  const max = Math.min(q95, 0);
  
  return { min, max };
};

// Map logprob to color class
const getTokenColorClass = (logprob: number, min: number, max: number) => {
  const normalized = (logprob - min) / (max - min);
  
  if (normalized < 0.25) return "token-low-prob";
  if (normalized < 0.5) return "token-med-low-prob";
  if (normalized < 0.75) return "token-med-high-prob";
  return "token-high-prob";
};

export const TokenText = ({ tokens, onTokenClick }: TokenTextProps) => {
  const [pinnedTooltip, setPinnedTooltip] = useState<number | null>(null);
  const [hoveredToken, setHoveredToken] = useState<number | null>(null);

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
        const colorClass = getTokenColorClass(token.logprob, min, max);
        const isLowProb = token.prob < 0.5; // Show dashed underline for low probability
        const showTooltip = hoveredToken === index || pinnedTooltip === index;

        return (
          <span key={index} className="relative">
            <span
              data-token-index={index}
              className={`token-span ${colorClass} ${isLowProb ? 'border-b-2 border-dashed' : ''}`}
              role="button"
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
              />
            )}
          </span>
        );
      })}
    </div>
  );
};