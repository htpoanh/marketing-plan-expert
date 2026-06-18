/**
 * Weekly Report Generate job — assembles the weekly_reports row.
 * Disabled by default; audit row in scheduled_runs. Optionally pings Telegram.
 */
import { db } from "@workspace/db";
import { scheduledRunsTable, weeklyReportsTable, type ScheduledRunStatus } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateWeeklyReport } from "../../services/weekly-report/generator.service";
import { dispatchDigest } from "../dispatcher";

export const WEEKLY_REPORT_GENERATE_KEY = "weekly_report_generate";

export async function runWeeklyReportGenerate(options: {
  trigger: "cron" | "manual";
}): Promise<{ runId: number; status: ScheduledRunStatus }> {
  const startedAt = Date.now();
  const [running] = await db
    .insert(scheduledRunsTable)
    .values({ jobKey: WEEKLY_REPORT_GENERATE_KEY, status: "running", trigger: options.trigger })
    .returning();
  const runId = running.id;

  try {
    const report = await generateWeeklyReport();
    const kpi = report.kpiData;

    const msg =
      `📊 *Wochenbericht KW ${report.weekNumber}* ist fertig.\n` +
      (kpi
        ? `• Bewertungen auto: ${kpi.reviewsAutoReplied} · eskaliert: ${kpi.reviewsEscalated}\n` +
          `• Kommentare: ${kpi.commentsHandled} · Trends vorgeschlagen: ${kpi.trendsProposed}\n` +
          `• Strategie-Ideen offen: ${kpi.strategyItemsPending}`
        : "");
    const dispatch = await dispatchDigest({
      eventType: WEEKLY_REPORT_GENERATE_KEY,
      text: msg,
      data: { reportId: report.id },
    });
    if (dispatch.ok) {
      await db
        .update(weeklyReportsTable)
        .set({ telegramSent: true })
        .where(eq(weeklyReportsTable.id, report.id));
    }

    await db
      .update(scheduledRunsTable)
      .set({
        status: "success",
        summary: { reportId: report.id, dispatch },
        payload: msg,
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
