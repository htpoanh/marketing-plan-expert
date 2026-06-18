/**
 * Phase D — scan + score trends for a brand.
 *
 * Reuses the M4 Claude Web-Search service (getTrendPulse), then for each trend
 * computes the 4 factors, the TREND SCORE, the Strategy-Inbox alignment, and a
 * recommended action. Returns rows ready to insert into trend_insights.
 */
import type { Brand, InsertTrendInsight } from "@workspace/db/schema";
import { getTrendPulse } from "../ads-strategy/trend.service";
import type { TrendOutput } from "../ads-strategy/output-validators";
import {
  computeTrendScore,
  scoreBucket,
  bucketToStatus,
  momentumToStrength,
  windowToDifficulty,
  computeStrategyAlignment,
} from "./scoring";

export type ScanResult = {
  items: InsertTrendInsight[];
  costEur: string | null;
};

const ACTION_BY_BUCKET: Record<string, string> = {
  propose_now: "Diese Woche umsetzen — hoher Score.",
  backlog: "In den Backlog — beobachten und ggf. später umsetzen.",
  skip: "Vorerst überspringen — niedriger Score.",
};

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = date.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

export async function scanTrends(
  brand: Brand,
  strategyTexts: string[],
  regionFocus: string,
): Promise<ScanResult> {
  const result = await getTrendPulse(
    { regionFocus, topic: null, outputLanguage: "de" },
    brand,
  );
  const output = result.output as TrendOutput;
  const week = isoWeek(new Date());

  const items: InsertTrendInsight[] = (output.trends ?? []).map((t) => {
    const trendText = `${t.topic} ${t.description ?? ""} ${(t.suggestedKeywords ?? []).join(" ")}`;
    const alignment = computeStrategyAlignment(trendText, strategyTexts);

    const factors = {
      trendStrength: momentumToStrength(t.momentum),
      relevance: t.relevanceScore,
      strategyAlignment: alignment.score,
      productionDifficulty: windowToDifficulty(t.estimatedWindowDays),
    };
    const score = computeTrendScore(factors);
    const bucket = scoreBucket(score);

    return {
      brandId: brand.id,
      trendName: t.topic,
      description: t.description ?? null,
      source: "claude",
      trendScore: score.toFixed(1),
      factors,
      momentum: t.momentum,
      estimatedWindowDays: t.estimatedWindowDays,
      suggestedAngle: t.suggestedAngle ?? null,
      suggestedKeywords: t.suggestedKeywords ?? [],
      strategyAlignmentNote:
        alignment.verdict === "align"
          ? "Passt zu einer Idee aus dem Strategie-Posteingang."
          : "Keine direkte Überschneidung mit dem Strategie-Posteingang.",
      recommendedAction: ACTION_BY_BUCKET[bucket],
      status: bucketToStatus(bucket),
      weekNumber: week,
    } satisfies InsertTrendInsight;
  });

  return { items, costEur: result.costEur };
}
