import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";

import type { ComposerHandle } from "@/components/Composer";
import { findNextLowConfidenceIndex } from "@/lib/utils";
import type { CompletionLP } from "@/types/logprob";

function buildTokenSelector(scopeId: string, tokenIndex: number): string {
  return `[data-token-scope="${scopeId}"][data-token-index="${tokenIndex}"]`;
}

function findTokenElement(
  scopeId: string,
  tokenIndex: number,
): HTMLElement | null {
  return document.querySelector(
    buildTokenSelector(scopeId, tokenIndex),
  ) as HTMLElement | null;
}

export interface UseTokenNavigationOptions {
  readonly composerRef: RefObject<ComposerHandle | null>;
  readonly currentCompletion: CompletionLP | null;
  readonly activeCompletionMessageId: string | null;
  readonly lastLowIndex: number | null;
  readonly onLastLowIndexChange: (index: number | null) => void;
  readonly onAnnounce: (message: string) => void;
}

export interface UseTokenNavigationResult {
  readonly highlightedTokenIndex: number | null;
  readonly resetTokenNavigation: () => void;
  readonly handleBranch: (tokenIndex: number, newToken: string) => void;
  readonly handleChartHover: (tokenIndex: number | null) => void;
  readonly scrollToToken: (tokenIndex: number, focus?: boolean) => void;
}

export function useTokenNavigation({
  composerRef,
  currentCompletion,
  activeCompletionMessageId,
  lastLowIndex,
  onLastLowIndexChange,
  onAnnounce,
}: UseTokenNavigationOptions): UseTokenNavigationResult {
  const [highlightedTokenIndex, setHighlightedTokenIndex] = useState<
    number | null
  >(null);

  const scrollToToken = useCallback(
    (tokenIndex: number, focus = false) => {
      if (activeCompletionMessageId === null) {
        return;
      }

      const tokenElement = findTokenElement(activeCompletionMessageId, tokenIndex);
      tokenElement?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      if (focus) {
        tokenElement?.focus();
      }
    },
    [activeCompletionMessageId],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isTyping =
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable;

      if (isTyping) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        composerRef.current?.focus();
        onAnnounce("Composer focused");
        return;
      }

      if (event.key === ".") {
        event.preventDefault();
        composerRef.current?.openParameters();
        onAnnounce("Parameters opened");
        return;
      }

      if (
        (event.key === "[" || event.key === "]") &&
        currentCompletion &&
        activeCompletionMessageId !== null
      ) {
        event.preventDefault();
        const direction = event.key === "]" ? 1 : -1;
        const nextIndex = findNextLowConfidenceIndex(
          currentCompletion.tokens,
          lastLowIndex,
          direction,
          0.5,
        );

        if (nextIndex !== null) {
          onLastLowIndexChange(nextIndex);
          setHighlightedTokenIndex(nextIndex);
          scrollToToken(nextIndex, true);
          onAnnounce(`Jumped to low-confidence token ${nextIndex}`);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeCompletionMessageId,
    composerRef,
    currentCompletion,
    lastLowIndex,
    onLastLowIndexChange,
    onAnnounce,
    scrollToToken,
  ]);

  return {
    highlightedTokenIndex,
    resetTokenNavigation() {
      setHighlightedTokenIndex(null);
      onLastLowIndexChange(null);
    },
    handleBranch(tokenIndex, newToken) {
      if (!currentCompletion || activeCompletionMessageId === null) {
        return;
      }

      const prefix = currentCompletion.tokens
        .slice(0, tokenIndex)
        .map((token) => token.token)
        .join("");

      composerRef.current?.setMessage(prefix + newToken);
      composerRef.current?.focus();
    },
    handleChartHover(tokenIndex) {
      if (activeCompletionMessageId === null) {
        setHighlightedTokenIndex(null);
        return;
      }

      setHighlightedTokenIndex(tokenIndex);
    },
    scrollToToken,
  };
}
