import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StickToBottomInstance } from "use-stick-to-bottom";

import { TokenTooltip } from "./TokenTooltip";

import {
  isPunctuationToken,
  isWhitespaceToken,
  calculateQuantiles,
  getTokenColorClass,
} from "@/lib/utils";
import type { TokenLP } from "@/types/logprob";

type ScrollContainerRef =
  | React.RefObject<HTMLElement>
  | StickToBottomInstance["scrollRef"];

interface TokenTextProps {
  tokens: TokenLP[];
  onTokenClick: (tokenIndex: number, newToken: string) => void;
  tokenScopeId: string;
  isInteractive?: boolean;
  showWhitespaceOverlays?: boolean;
  showPunctuationOverlays?: boolean;
  /** Optional scroll container to drive progressive virtualization. */
  scrollContainerRef?: ScrollContainerRef;
  /** Optional precomputed quantiles for consistent coloring across chunks. */
  quantiles?: { readonly min: number; readonly max: number };
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
  showWhitespaceOverlays = false,
  showPunctuationOverlays = false,
  scrollContainerRef,
  quantiles,
}: TokenTextProps) => {
  const [pinnedTooltip, setPinnedTooltip] = useState<number | null>(null);
  const [hoveredToken, setHoveredToken] = useState<number | null>(null);
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Quantiles are memoized and can be provided from parent to keep color scale stable
  const { min, max } = useMemo(
    () => quantiles ?? calculateQuantiles(tokens),
    [tokens, quantiles],
  );

  // Progressive virtualization: render in slices when token count is large to avoid
  // mounting hundreds of spans at once. We increment on intersection with a sentinel.
  const VIRTUALIZE_THRESHOLD = 200;
  const SLICE_INCREMENT = 200;
  const [visibleCount, setVisibleCount] = useState<number>(() =>
    tokens.length > VIRTUALIZE_THRESHOLD ? VIRTUALIZE_THRESHOLD : tokens.length,
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Reset visible count when tokens set changes (e.g., new completion)
    setVisibleCount(
      tokens.length > VIRTUALIZE_THRESHOLD
        ? VIRTUALIZE_THRESHOLD
        : tokens.length,
    );
  }, [tokens]);

  useEffect(() => {
    if (visibleCount >= tokens.length) return; // nothing to observe
    const root = scrollContainerRef?.current ?? null;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let rafId: number | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          // Batch the state update into next animation frame to minimize layout thrash
          if (rafId !== null) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            setVisibleCount((prev) =>
              Math.min(prev + SLICE_INCREMENT, tokens.length),
            );
          });
        }
      },
      { root, rootMargin: "800px 0px", threshold: 0 },
    );
    io.observe(sentinel);
    return () => {
      io.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [visibleCount, tokens.length, scrollContainerRef]);

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

  const renderCount = visibleCount;
  return (
    <div className="relative leading-relaxed" aria-live="polite">
      {tokens.slice(0, renderCount).map((token) => {
        const tokenIndex = token.index;
        const tokenIsWhitespace = isWhitespaceToken(token.token);
        const tokenIsPunct = isPunctuationToken(token.token);

        let colorClass: string = getTokenColorClass(token.logprob, min, max);
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
              className={`token-span ${colorClass} border-b-2 ${isLowProb ? "border-dashed border-border" : "border-transparent"}`}
              role={isInteractive ? "button" : undefined}
              aria-pressed={isInteractive && pinnedTooltip === tokenIndex ? true : undefined}
              tabIndex={isInteractive ? 0 : undefined}
              aria-describedby={showTooltip ? tooltipId : undefined}
              aria-label={`Token ${JSON.stringify(token.token)}, probability ${(token.prob * 100).toFixed(1)}%`}
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
                min={min}
                max={max}
                anchorEl={spanRefs.current[tokenIndex]}
              />
            )}
          </span>
        );
      })}
      {renderCount < tokens.length && (
        <div ref={sentinelRef} aria-hidden className="h-4" />
      )}
    </div>
  );
};
