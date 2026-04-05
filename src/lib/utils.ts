import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind class lists while removing conflicts for deterministic styling.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Token utilities
import type { TokenLP } from "@/types/logprob";

export type TokenProbabilityBand =
  | "low"
  | "med-low"
  | "med-high"
  | "high";

interface TokenProbabilityBandMeta {
  readonly band: TokenProbabilityBand;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly surfaceClassName: string;
  readonly textClassName: string;
}

export const TOKEN_PROBABILITY_BANDS: readonly TokenProbabilityBandMeta[] = [
  {
    band: "high",
    label: "High probability",
    min: 0.75,
    max: 1,
    surfaceClassName: "token-high-prob",
    textClassName: "text-token-high",
  },
  {
    band: "med-high",
    label: "Medium-high probability",
    min: 0.5,
    max: 0.75,
    surfaceClassName: "token-med-high-prob",
    textClassName: "text-token-med-high",
  },
  {
    band: "med-low",
    label: "Medium-low probability",
    min: 0.25,
    max: 0.5,
    surfaceClassName: "token-med-low-prob",
    textClassName: "text-token-med-low",
  },
  {
    band: "low",
    label: "Low probability",
    min: 0,
    max: 0.25,
    surfaceClassName: "token-low-prob",
    textClassName: "text-token-low",
  },
] as const;

/**
 * Returns true if the token string is entirely whitespace (spaces, tabs, newlines).
 */
export function isWhitespaceToken(token: string): boolean {
  return /^\s+$/.test(token);
}

/**
 * Returns true if the token string is exclusively punctuation characters.
 * The set is conservative ASCII punctuation for predictability.
 */
export function isPunctuationToken(token: string): boolean {
  // Remove whitespace for robust detection when token includes leading spaces
  const trimmed = token.replace(/\s+/g, "");
  if (trimmed.length === 0) return false;
  return /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]+$/.test(trimmed);
}

/**
 * Find the next low-confidence token index given a starting point.
 * - direction: 1 for forward, -1 for backward
 * - threshold: probability strictly less than this value is considered low-confidence
 */
export function findNextLowConfidenceIndex(
  tokens: readonly TokenLP[],
  startIndex: number | null,
  direction: 1 | -1,
  threshold: number = 0.5,
): number | null {
  if (!tokens.length) return null;
  const begin =
    typeof startIndex === "number"
      ? startIndex + direction
      : direction > 0
        ? 0
        : tokens.length - 1;
  for (let i = begin; i >= 0 && i < tokens.length; i += direction) {
    if (tokens[i]?.prob < threshold) return i;
  }
  return null;
}

export function formatProbabilityPercent(
  prob: number,
  fractionDigits: number = 2,
): string {
  if (!Number.isFinite(prob) || prob < 0) {
    return `< 0.${"0".repeat(Math.max(fractionDigits - 1, 0))}1%`;
  }

  const scale = 10 ** fractionDigits;
  const clampedProb = Math.min(prob, 1);
  const flooredPercent = Math.floor(clampedProb * 100 * scale) / scale;

  if (flooredPercent < 1 / scale) {
    return `< 0.${"0".repeat(Math.max(fractionDigits - 1, 0))}1%`;
  }

  if (clampedProb < 1) {
    const cappedPercent = Math.min(flooredPercent, 100 - 1 / scale);
    return `${cappedPercent.toFixed(fractionDigits)}%`;
  }

  return `${flooredPercent.toFixed(fractionDigits)}%`;
}

/** Map an absolute probability to one of the token color classes. */
export function getTokenColorClass(
  prob: number,
):
  | "token-low-prob"
  | "token-med-low-prob"
  | "token-med-high-prob"
  | "token-high-prob" {
  if (prob < 0.25) return "token-low-prob";
  if (prob < 0.5) return "token-med-low-prob";
  if (prob < 0.75) return "token-med-high-prob";
  return "token-high-prob";
}

export function getTokenProbabilityBand(prob: number): TokenProbabilityBand {
  if (prob < 0.25) return "low";
  if (prob < 0.5) return "med-low";
  if (prob < 0.75) return "med-high";
  return "high";
}

export function getTokenProbabilityBandMeta(
  prob: number,
): TokenProbabilityBandMeta {
  const band = getTokenProbabilityBand(prob);

  return TOKEN_PROBABILITY_BANDS.find((entry) => entry.band === band)!;
}

/** Return matching text color class for a token color class. */
export function tokenColorToTextClass(tokenClass: string): string {
  switch (tokenClass) {
    case "token-low-prob":
      return "text-token-low";
    case "token-med-low-prob":
      return "text-token-med-low";
    case "token-med-high-prob":
      return "text-token-med-high";
    case "token-high-prob":
      return "text-token-high";
    default:
      return "";
  }
}
