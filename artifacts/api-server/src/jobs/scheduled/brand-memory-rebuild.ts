/**
 * Weekly Brand Memory Rebuild job — recomputes brand_memory for every brand.
 * Disabled by default; audit row written to scheduled_runs.
 */
import { db } from "@workspace/db";
import { brandsTable, scheduledRunsTable, type ScheduledRunStatus } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { rebuildBrandMemory } from "../../services/brand-memory/aggregate.service";

export const BRAND_MEMORY_REBUILD_KEY = "brand_memory_rebuild";

export async function runBrandMemoryRebuild(options: {
  trigger: "cron" | "manual";
}): Promise<{ runId: number; status: ScheduledRunStatus }> {
  const startedAt = Date.now();
  const [running] = await db
    .insert(scheduledRunsTable)
    .values({ jobKey: BRAND_MEMORY_REBUILD_KEY, status: "running", trigger: options.trigger })
    .returning();
  const runId = running.id;

  try {
    const brands = await db.select().from(brandsTable);
    let processed = 0;
    let failed = 0;
    for (const brand of brands) {
      try {
        await rebuildBrandMemory(brand.id);
        processed++;
      } catch (e) {
        failed++;
        console.error(`[brand-memory-rebuild] brand ${brand.id} failed: ${String(e)}`);
      }
    }
    const status: ScheduledRunStatus =
      failed === 0 ? "success" : processed === 0 ? "failed" : "partial";
    await db
      .update(scheduledRunsTable)
      .set({
        status,
        brandsProcessed: processed,
        brandsFailed: failed,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
      })
      .where(eq(scheduledRunsTable.id, runId));
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
