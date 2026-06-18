/**
 * Phase C — orchestrate all collectors for one brand and stamp brandId + week.
 */
import type { Brand, InsertMarketIntelligence } from "@workspace/db/schema";
import {
  collectNews,
  collectMapsCompetitors,
  collectTrends,
  collectReddit,
  collectTiktok,
} from "./collectors";

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

function pickRegion(brand: Brand): string {
  const ctx = (brand.adsContext ?? {}) as { primaryRegions?: string[] };
  return ctx.primaryRegions?.[0] ?? brand.branchLocation;
}

export async function scanMarketIntelligence(
  brand: Brand,
): Promise<InsertMarketIntelligence[]> {
  const region = pickRegion(brand);
  const week = isoWeek(new Date());

  const [news, maps, trends, reddit, tiktok] = await Promise.all([
    collectNews(`${region} ${brand.industry}`),
    collectMapsCompetitors(`${brand.industry} ${region}`),
    collectTrends(`${brand.industry} ${region}`),
    collectReddit(`${brand.industry} ${region}`),
    collectTiktok(`${brand.industry}`),
  ]);

  const all = [...news, ...maps, ...trends, ...reddit, ...tiktok];
  return all.map((row) => ({
    ...row,
    brandId: brand.id,
    weekNumber: week,
  }));
}
