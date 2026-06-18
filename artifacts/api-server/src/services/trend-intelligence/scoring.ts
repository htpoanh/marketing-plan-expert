/**
 * Phase D — TREND SCORE (pure, testable).
 *
 *   TREND SCORE = trendStrength × relevance × strategyAlignment ÷ productionDifficulty
 *   each factor 1-10.
 *
 * Buckets (v3.0): >50 propose now · 30-50 backlog · <30 skip.
 */
import type { TrendFactors } from "@workspace/db/schema";

export type TrendBucket = "propose_now" | "backlog" | "skip";

const clamp1to10 = (n: number): number => Math.max(1, Math.min(10, Math.round(n)));

export function computeTrendScore(factors: TrendFactors): number {
  const strength = clamp1to10(factors.trendStrength);
  const relevance = clamp1to10(factors.relevance);
  const alignment = clamp1to10(factors.strategyAlignment);
  const difficulty = clamp1to10(factors.productionDifficulty);
  const score = (strength * relevance * alignment) / difficulty;
  return Math.round(score * 10) / 10;
}

export function scoreBucket(score: number): TrendBucket {
  if (score > 50) return "propose_now";
  if (score >= 30) return "backlog";
  return "skip";
}

export function bucketToStatus(bucket: TrendBucket): "proposed" | "backlog" | "skipped" {
  switch (bucket) {
    case "propose_now":
      return "proposed";
    case "backlog":
      return "backlog";
    case "skip":
      return "skipped";
  }
}

/** Map M4 momentum → a trend-strength factor (1-10). Peak is strongest now. */
export function momentumToStrength(momentum: string): number {
  switch (momentum) {
    case "peak":
      return 9;
    case "rising":
      return 7;
    case "declining":
      return 3;
    default:
      return 5;
  }
}

/**
 * Shorter capitalization window ⇒ harder to produce in time ⇒ higher difficulty.
 * <=3 days → 9 (very hard), <=7 → 6, <=14 → 4, else 3 (comfortable).
 */
export function windowToDifficulty(estimatedWindowDays: number): number {
  if (estimatedWindowDays <= 3) return 9;
  if (estimatedWindowDays <= 7) return 6;
  if (estimatedWindowDays <= 14) return 4;
  return 3;
}

const STOPWORDS = new Set([
  "der", "die", "das", "und", "für", "fuer", "mit", "ein", "eine", "the", "and",
  "for", "with", "von", "im", "in", "auf", "zu", "ist", "trend", "trends", "2026",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    (text ?? "")
      .toLowerCase()
      .replace(/[^a-zäöüß0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

/**
 * Strategy alignment factor (1-10) from keyword overlap between the trend text
 * and the user's Strategy Inbox content. No strategy items ⇒ neutral 5.
 * Returns { score, verdict } where verdict is align | neutral.
 */
export function computeStrategyAlignment(
  trendText: string,
  strategyTexts: string[],
): { score: number; verdict: "align" | "neutral" } {
  if (strategyTexts.length === 0) return { score: 5, verdict: "neutral" };

  const trendWords = significantWords(trendText);
  const stratWords = significantWords(strategyTexts.join(" "));
  let overlap = 0;
  for (const w of trendWords) if (stratWords.has(w)) overlap++;

  if (overlap === 0) return { score: 4, verdict: "neutral" };
  // 1 shared word → 6, scaling up to 10.
  const score = clamp1to10(5 + overlap * 1.5);
  return { score, verdict: "align" };
}
