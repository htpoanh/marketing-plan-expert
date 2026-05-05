/**
 * Cron scheduler — registered once per api-server boot.
 *
 * Pattern:
 *   - On boot, read scheduled_jobs from DB
 *   - For each enabled row, register a node-cron task with its expression
 *   - Each tick: re-read the DB row to check enabled flag (cheap — single
 *     row lookup) and skip the run if it's been disabled since boot
 *   - This means toggling enabled in the UI takes effect on the NEXT tick
 *     (no need to restart the server)
 *
 * Disabled in NODE_ENV=test so vitest doesn't accidentally fire jobs.
 */
import cron, { type ScheduledTask } from "node-cron";
import { db } from "@workspace/db";
import { scheduledJobsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

import {
  WEEKLY_TREND_DIGEST_KEY,
  runWeeklyTrendDigest,
} from "./scheduled/weekly-trend-digest";

type JobRunner = (trigger: "cron" | "manual") => Promise<void>;

const JOB_RUNNERS: Record<string, JobRunner> = {
  [WEEKLY_TREND_DIGEST_KEY]: async (trigger) => {
    await runWeeklyTrendDigest({ trigger });
  },
};

const TIMEZONE = "Europe/Berlin";

const registered: ScheduledTask[] = [];

export async function startScheduler(): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    console.log("[scheduler] NODE_ENV=test — skipping cron registration");
    return;
  }
  if (process.env.SCHEDULER_DISABLED === "1") {
    console.log("[scheduler] SCHEDULER_DISABLED=1 — skipping cron registration");
    return;
  }

  let jobs: Awaited<ReturnType<typeof loadJobs>>;
  try {
    jobs = await loadJobs();
  } catch (e) {
    // Most common reason: scheduled_jobs table doesn't exist yet (migration
    // not applied). Don't crash the api-server — just log + skip.
    console.warn(
      `[scheduler] Could not load jobs (migration applied?): ${e instanceof Error ? e.message : String(e)}`,
    );
    return;
  }

  for (const job of jobs) {
    const runner = JOB_RUNNERS[job.jobKey];
    if (!runner) {
      console.warn(
        `[scheduler] Unknown job_key in DB: ${job.jobKey} — no runner registered`,
      );
      continue;
    }
    if (!cron.validate(job.cronExpression)) {
      console.warn(
        `[scheduler] Invalid cron expression for ${job.jobKey}: "${job.cronExpression}"`,
      );
      continue;
    }

    const task = cron.schedule(
      job.cronExpression,
      async () => {
        // Re-check enabled flag on every tick — let the user disable from UI
        // without restarting the server.
        const [current] = await db
          .select({
            enabled: scheduledJobsTable.enabled,
          })
          .from(scheduledJobsTable)
          .where(eq(scheduledJobsTable.jobKey, job.jobKey));
        if (!current?.enabled) {
          console.log(
            `[scheduler] ${job.jobKey} fired but disabled — skipping`,
          );
          return;
        }
        console.log(`[scheduler] Firing ${job.jobKey}`);
        try {
          await runner("cron");
          console.log(`[scheduler] ${job.jobKey} done`);
        } catch (e) {
          // Job runner already persists errors to scheduled_runs; just log
          console.error(
            `[scheduler] ${job.jobKey} threw outside its runner:`,
            e,
          );
        }
      },
      { timezone: TIMEZONE },
    );

    registered.push(task);
    console.log(
      `[scheduler] Registered ${job.jobKey} on "${job.cronExpression}" (${TIMEZONE}) — currently ${job.enabled ? "enabled" : "disabled"}`,
    );
  }
}

async function loadJobs() {
  return db.select().from(scheduledJobsTable);
}

/** Stop all registered cron tasks. Useful for graceful shutdown / tests. */
export function stopScheduler(): void {
  for (const task of registered) {
    task.stop();
  }
  registered.length = 0;
}

/**
 * Manual trigger — used by the /automation UI's "Run now" button. Bypasses
 * cron and the enabled flag (so the user can test even when disabled), but
 * still goes through the runner (so the audit row is created).
 */
export async function triggerJobNow(jobKey: string): Promise<void> {
  const runner = JOB_RUNNERS[jobKey];
  if (!runner) {
    throw new Error(`Unknown job key: ${jobKey}`);
  }
  await runner("manual");
}
