/**
 * Phase I — rebuild a brand's learning memory from available signals.
 *
 * Today we can mine:
 *   - reply_queue   → which intents customers raise most (topIntentKeywords)
 *   - trend_insights → highest-scored trends the brand aligned with
 * Performance-derived fields (formats, save/completion rates, ads history) are
 * left for Phase A/F to populate; the rebuild keeps any existing values.
 */
import { db } from "@workspace/db";
import {
  brandMemoryTable,
  replyQueueTable,
  trendInsightsTable,
  type BrandMemory,
} from "@workspace/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

// ── Pure aggregation helpers (testable) ──────────────────────────────────────

export function tallyIntents(
  rows: Array<{ intent: string | null }>,
): Array<{ intent: string; count: number }> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.intent) continue;
    counts.set(r.intent, (counts.get(r.intent) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count);
}

export function topTrendAlignments(
  rows: Array<{ trendName: string; trendScore: string }>,
  limit = 5,
): Array<{ trend: string; score: number }> {
  return rows
    .map((r) => ({ trend: r.trendName, score: parseFloat(r.trendScore) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── DB rebuild (upsert) ───────────────────────────────────────────────────────

export async function rebuildBrandMemory(brandId: number): Promise<BrandMemory> {
  const intentRows = await db
    .select({ intent: replyQueueTable.intent })
    .from(replyQueueTable)
    .where(eq(replyQueueTable.brandId, brandId));
  const topIntentKeywords = tallyIntents(intentRows);

  const trendRows = await db
    .select({ trendName: trendInsightsTable.trendName, trendScore: trendInsightsTable.trendScore })
    .from(trendInsightsTable)
    .where(
      and(
        eq(trendInsightsTable.brandId, brandId),
        sql`${trendInsightsTable.status} IN ('proposed', 'actioned', 'backlog')`,
      ),
    )
    .orderBy(desc(trendInsightsTable.trendScore))
    .limit(20);
  const trendAlignments = topTrendAlignments(trendRows);

  const [existing] = await db
    .select()
    .from(brandMemoryTable)
    .where(eq(brandMemoryTable.brandId, brandId));

  if (existing) {
    const [updated] = await db
      .update(brandMemoryTable)
      .set({
        version: existing.version + 1,
        topIntentKeywords,
        trendAlignments,
        updatedAt: new Date(),
      })
      .where(eq(brandMemoryTable.brandId, brandId))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(brandMemoryTable)
    .values({ brandId, topIntentKeywords, trendAlignments })
    .returning();
  return created;
}
