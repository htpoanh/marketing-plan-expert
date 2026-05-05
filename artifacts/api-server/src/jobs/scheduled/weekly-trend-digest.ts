/**
 * Weekly Trend Digest job.
 *
 * For every brand whose ads_context has primaryRegions set:
 *   1. Run M4 Trend Pulse via the existing service (cache hits are FREE)
 *   2. Format the top 3 trends per brand into a Markdown message
 *   3. Dispatch via Telegram / Make.com webhook (see dispatcher.ts)
 *   4. Audit-log the run in scheduled_runs
 *
 * Designed to be safe to retry — at-most-once delivery is fine for a
 * weekly digest. If half the brands fail, we still send the partial
 * result so the user gets *something*.
 */
import { db } from "@workspace/db";
import {
  brandsTable,
  scheduledJobsTable,
  scheduledRunsTable,
  type Brand,
  type ScheduledRunStatus,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getTrendPulse } from "../../services/ads-strategy/trend.service";
import { dispatchDigest } from "../dispatcher";
import type { TrendOutput } from "../../services/ads-strategy/output-validators";

export const WEEKLY_TREND_DIGEST_KEY = "weekly_trend_digest";

type BrandResult = {
  brandId: number;
  brandName: string;
  region: string;
  ok: boolean;
  trendCount?: number;
  topTrends?: Array<{
    topic: string;
    relevanceScore: number;
    momentum: string;
    suggestedAngle: string;
  }>;
  costEur?: string | null;
  error?: string;
};

// ── Pure formatter (testable without DB or AI) ───────────────────────────────
export function formatDigestMessage(
  results: BrandResult[],
  generatedAt: Date,
): string {
  const successful = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  const lines: string[] = [];
  lines.push("📈 *Weekly Trend Digest*");
  lines.push(
    `_${generatedAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} (Europe/Berlin)_`,
  );
  lines.push("");
  lines.push(
    `Brands processed: *${successful.length}*${failed.length > 0 ? ` (failed: ${failed.length})` : ""}`,
  );

  const totalCost = successful.reduce(
    (sum, r) => sum + parseFloat(r.costEur ?? "0"),
    0,
  );
  lines.push(`AI cost: *€${totalCost.toFixed(4)}*`);
  lines.push("");

  if (successful.length === 0) {
    lines.push("⚠ No brand returned trends this week.");
    if (failed.length > 0) {
      lines.push("");
      lines.push("*Failures:*");
      for (const f of failed) {
        lines.push(`• ${f.brandName} — ${f.error ?? "unknown"}`);
      }
    }
    return lines.join("\n");
  }

  for (const r of successful) {
    lines.push(`*${r.brandName}* (${r.region})`);
    if (!r.topTrends || r.topTrends.length === 0) {
      lines.push("  _No trends returned._");
      lines.push("");
      continue;
    }
    for (const [i, t] of r.topTrends.entries()) {
      const momentumIcon =
        t.momentum === "rising" ? "📈" : t.momentum === "peak" ? "🔥" : "📉";
      lines.push(
        `  ${i + 1}. ${momentumIcon} *${t.topic}* (${t.relevanceScore}/10)`,
      );
      lines.push(`     💡 ${t.suggestedAngle}`);
    }
    lines.push("");
  }

  if (failed.length > 0) {
    lines.push("⚠ *Failures:*");
    for (const f of failed) {
      lines.push(`• ${f.brandName} — ${f.error ?? "unknown"}`);
    }
  }

  return lines.join("\n").trim();
}

/**
 * Pick which brands the digest should run for. Default rule: any brand
 * with at least one entry in `ads_context.primaryRegions`. Caller can
 * override via `config.brandIds` on the scheduled_jobs row.
 */
export function selectBrandsForDigest(
  brands: Brand[],
  config: { brandIds?: number[] } | null | undefined,
): Brand[] {
  if (config?.brandIds && config.brandIds.length > 0) {
    const set = new Set(config.brandIds);
    return brands.filter((b) => set.has(b.id));
  }
  return brands.filter((b) => {
    const ctx = (b.adsContext ?? {}) as { primaryRegions?: string[] };
    return (ctx.primaryRegions?.length ?? 0) > 0;
  });
}

function pickRegion(brand: Brand): string {
  const ctx = (brand.adsContext ?? {}) as { primaryRegions?: string[] };
  return ctx.primaryRegions?.[0] ?? brand.branchLocation;
}

// ── Runner (touches DB + AI) ─────────────────────────────────────────────────
export type RunOptions = {
  trigger: "cron" | "manual";
  /** When true, skip the cache (force fresh Grok call). Off by default — we
   *  WANT cache hits because they make the digest free for repeat runs. */
  bypassCache?: boolean;
};

export async function runWeeklyTrendDigest(
  options: RunOptions,
): Promise<{ runId: number; status: ScheduledRunStatus }> {
  const startedAt = Date.now();

  // Insert audit row in 'running' state so the UI shows progress
  const [running] = await db
    .insert(scheduledRunsTable)
    .values({
      jobKey: WEEKLY_TREND_DIGEST_KEY,
      status: "running",
      trigger: options.trigger,
    })
    .returning();
  const runId = running.id;

  try {
    // Load job config (may have brandIds allowlist)
    const [jobRow] = await db
      .select()
      .from(scheduledJobsTable)
      .where(eq(scheduledJobsTable.jobKey, WEEKLY_TREND_DIGEST_KEY));
    const config = jobRow?.config ?? null;

    // Select brands
    const allBrands = await db.select().from(brandsTable);
    const targets = selectBrandsForDigest(allBrands, config as { brandIds?: number[] } | null);

    if (targets.length === 0) {
      await finishRun(runId, {
        status: "success",
        summary: {
          message: "No brands have ads_context.primaryRegions set yet.",
        },
        brandsProcessed: 0,
        brandsFailed: 0,
        durationMs: Date.now() - startedAt,
      });
      return { runId, status: "success" };
    }

    const results: BrandResult[] = [];
    let totalCostEur = 0;

    for (const brand of targets) {
      const region = pickRegion(brand);
      try {
        const result = await getTrendPulse(
          {
            regionFocus: region,
            topic: null,
            outputLanguage: "vi",
          },
          brand,
        );
        const output = result.output as TrendOutput;
        const topTrends = (output.trends ?? [])
          .slice()
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 3)
          .map((t) => ({
            topic: t.topic,
            relevanceScore: t.relevanceScore,
            momentum: t.momentum,
            suggestedAngle: t.suggestedAngle,
          }));
        const costStr = result.costEur ?? "0";
        totalCostEur += parseFloat(costStr);
        results.push({
          brandId: brand.id,
          brandName: brand.brandName,
          region,
          ok: true,
          trendCount: output.trends?.length ?? 0,
          topTrends,
          costEur: costStr,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(
          `[weekly-trend-digest] brand ${brand.id} (${brand.brandName}) failed: ${message}`,
        );
        results.push({
          brandId: brand.id,
          brandName: brand.brandName,
          region,
          ok: false,
          error: message,
        });
      }
    }

    const message = formatDigestMessage(results, new Date());
    const dispatch = await dispatchDigest({
      eventType: WEEKLY_TREND_DIGEST_KEY,
      text: message,
      data: { results, totalCostEur },
    });

    const successful = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    const status: ScheduledRunStatus =
      failed === 0
        ? "success"
        : successful === 0
          ? "failed"
          : "partial";

    await finishRun(runId, {
      status,
      summary: {
        results,
        dispatch,
        targetCount: targets.length,
      },
      payload: message,
      totalCostEur: totalCostEur.toFixed(4),
      brandsProcessed: successful,
      brandsFailed: failed,
      durationMs: Date.now() - startedAt,
    });

    // Bump scheduled_jobs.last_run_at so the UI can show "last ran X ago"
    await db
      .update(scheduledJobsTable)
      .set({ lastRunAt: new Date(), updatedAt: new Date() })
      .where(eq(scheduledJobsTable.jobKey, WEEKLY_TREND_DIGEST_KEY));

    return { runId, status };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[weekly-trend-digest] FATAL", message);
    await finishRun(runId, {
      status: "failed",
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    return { runId, status: "failed" };
  }
}

async function finishRun(
  runId: number,
  patch: Partial<typeof scheduledRunsTable.$inferInsert>,
): Promise<void> {
  await db
    .update(scheduledRunsTable)
    .set({ ...patch, finishedAt: new Date() })
    .where(eq(scheduledRunsTable.id, runId));
}

