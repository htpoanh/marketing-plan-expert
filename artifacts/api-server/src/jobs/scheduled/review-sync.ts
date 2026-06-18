/**
 * Standalone Google Review Sync job.
 *
 * Pulls the latest Google Business Profile reviews for every connected brand,
 * INDEPENDENT of the auto-reply engine — so reviews stay fresh on the
 * dashboard even when a brand has auto-reply turned off.
 *
 * For each brand:
 *   - syncGmbForBrand (paginates ALL reviews, upserts into `reviews`)
 *   - brands without a GBP connection return ok:false/401 → counted as
 *     "skipped" (not a failure), so a partly-connected portfolio still
 *     reports success.
 *
 * Disabled by default (scheduled_jobs seed). Audit row written to
 * scheduled_runs. Safe to retry — sync is idempotent (upsert by review id).
 */
import { db } from "@workspace/db";
import {
  brandsTable,
  scheduledRunsTable,
  scheduledJobsTable,
  type ScheduledRunStatus,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { syncGmbForBrand } from "../../routes/reviews";

export const REVIEW_SYNC_KEY = "review_sync";

type BrandSyncDetail = {
  brandId: number;
  brandName: string;
  ok: boolean;
  imported?: number;
  total?: number;
  error?: string;
};

export async function runReviewSync(options: {
  trigger: "cron" | "manual";
}): Promise<{ runId: number; status: ScheduledRunStatus }> {
  const startedAt = Date.now();
  const [running] = await db
    .insert(scheduledRunsTable)
    .values({ jobKey: REVIEW_SYNC_KEY, status: "running", trigger: options.trigger })
    .returning();
  const runId = running.id;

  try {
    const brands = await db.select().from(brandsTable);
    let processed = 0; // brands successfully synced
    let failed = 0; // brands that errored (excluding "not connected")
    let skipped = 0; // brands without a GBP connection
    let importedTotal = 0;
    const details: BrandSyncDetail[] = [];

    for (const brand of brands) {
      try {
        const result = await syncGmbForBrand(brand.id);
        if (result.ok) {
          processed++;
          importedTotal += result.data.imported;
          details.push({
            brandId: brand.id,
            brandName: brand.brandName,
            ok: true,
            imported: result.data.imported,
            total: result.data.total,
          });
        } else if (result.status === 401) {
          // Brand not connected to Google Business Profile — skip quietly.
          skipped++;
        } else {
          failed++;
          details.push({
            brandId: brand.id,
            brandName: brand.brandName,
            ok: false,
            error: result.error,
          });
        }
      } catch (e) {
        failed++;
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[review-sync] brand ${brand.id} (${brand.brandName}) threw: ${message}`);
        details.push({ brandId: brand.id, brandName: brand.brandName, ok: false, error: message });
      }
    }

    const status: ScheduledRunStatus =
      failed === 0 ? "success" : processed === 0 ? "failed" : "partial";

    await db
      .update(scheduledRunsTable)
      .set({
        status,
        summary: { processed, failed, skipped, importedTotal, details },
        brandsProcessed: processed,
        brandsFailed: failed,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
      })
      .where(eq(scheduledRunsTable.id, runId));

    // Bump scheduled_jobs.last_run_at so the UI shows "last ran X ago".
    await db
      .update(scheduledJobsTable)
      .set({ lastRunAt: new Date(), updatedAt: new Date() })
      .where(eq(scheduledJobsTable.jobKey, REVIEW_SYNC_KEY));

    return { runId, status };
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
