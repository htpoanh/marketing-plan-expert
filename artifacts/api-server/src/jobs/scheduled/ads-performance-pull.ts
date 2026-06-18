/**
 * Weekly Ads Performance Pull — runs the ad-platform readers for every brand.
 * Disabled by default; readers without keys simply report inactive.
 */
import { db } from "@workspace/db";
import {
  brandsTable,
  adsPerformanceTable,
  scheduledRunsTable,
  ADS_PLATFORMS,
  type ScheduledRunStatus,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { READERS } from "../../services/ads-analysis/readers";

export const ADS_PERFORMANCE_PULL_KEY = "ads_performance_pull";

function isoWeekStart(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export async function runAdsPerformancePull(options: {
  trigger: "cron" | "manual";
}): Promise<{ runId: number; status: ScheduledRunStatus }> {
  const startedAt = Date.now();
  const [running] = await db
    .insert(scheduledRunsTable)
    .values({ jobKey: ADS_PERFORMANCE_PULL_KEY, status: "running", trigger: options.trigger })
    .returning();
  const runId = running.id;

  try {
    const brands = await db.select().from(brandsTable);
    const weekStart = isoWeekStart();
    let inserted = 0;
    let inactive = 0;
    for (const brand of brands) {
      for (const platform of ADS_PLATFORMS) {
        try {
          const result = await READERS[platform](brand.id, weekStart);
          if (result.active) {
            await db.insert(adsPerformanceTable).values(result.row);
            inserted++;
          } else {
            inactive++;
          }
        } catch {
          inactive++;
        }
      }
    }
    await db
      .update(scheduledRunsTable)
      .set({
        status: "success",
        summary: { inserted, inactive, brands: brands.length },
        brandsProcessed: brands.length,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
      })
      .where(eq(scheduledRunsTable.id, runId));
    return { runId, status: "success" };
  } catch (e) {
    await db
      .update(scheduledRunsTable)
      .set({
        status: "failed",
        errorMessage: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
      })
      .where(eq(scheduledRunsTable.id, runId));
    return { runId, status: "failed" };
  }
}
