/**
 * Weekly Market Intelligence Scan — runs collectors for every brand.
 * Disabled by default; audit row in scheduled_runs.
 */
import { db } from "@workspace/db";
import {
  brandsTable,
  marketIntelligenceTable,
  scheduledRunsTable,
  type ScheduledRunStatus,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { scanMarketIntelligence } from "../../services/market-intelligence/synthesizer";

export const MARKET_INTELLIGENCE_SCAN_KEY = "market_intelligence_scan";

export async function runMarketIntelligenceScan(options: {
  trigger: "cron" | "manual";
}): Promise<{ runId: number; status: ScheduledRunStatus }> {
  const startedAt = Date.now();
  const [running] = await db
    .insert(scheduledRunsTable)
    .values({ jobKey: MARKET_INTELLIGENCE_SCAN_KEY, status: "running", trigger: options.trigger })
    .returning();
  const runId = running.id;

  try {
    const brands = await db.select().from(brandsTable);
    let processed = 0;
    let failed = 0;
    let totalRows = 0;
    for (const brand of brands) {
      try {
        const rows = await scanMarketIntelligence(brand);
        if (rows.length > 0) {
          await db.insert(marketIntelligenceTable).values(rows);
          totalRows += rows.length;
        }
        processed++;
      } catch (e) {
        failed++;
        console.error(`[market-intelligence-scan] brand ${brand.id} failed: ${String(e)}`);
      }
    }
    const status: ScheduledRunStatus =
      failed === 0 ? "success" : processed === 0 ? "failed" : "partial";
    await db
      .update(scheduledRunsTable)
      .set({
        status,
        summary: { totalRows },
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
