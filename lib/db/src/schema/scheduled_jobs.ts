import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  decimal,
  index,
  check,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Scheduled-job catalog. One row per unique cron job we ship. Phase 5a
 * starts with a single key 'weekly_trend_digest' but the table is generic
 * enough that future jobs (weekly performance review, monthly cost rollup,
 * etc.) just add another row.
 *
 * The `enabled` toggle is what the UI on /automation flips. The cron
 * scheduler reads this on each tick and skips disabled jobs.
 */
export const scheduledJobsTable = pgTable("scheduled_jobs", {
  id: serial("id").primaryKey(),
  /** Unique key referenced from code (e.g. "weekly_trend_digest"). */
  jobKey: text("job_key").notNull().unique(),
  /** Human-readable name for the UI. */
  name: text("name").notNull(),
  /** Standard 5-field cron expression in Europe/Berlin TZ. */
  cronExpression: text("cron_expression").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  /** Free-form per-job config (e.g. brand allowlist, region overrides). */
  config: jsonb("config").$type<Record<string, unknown>>(),
  /** Set after each successful run. */
  lastRunAt: timestamp("last_run_at"),
  /** Set when scheduler resolves the next fire time (informational). */
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ScheduledJob = typeof scheduledJobsTable.$inferSelect;
export type InsertScheduledJob = typeof scheduledJobsTable.$inferInsert;

/**
 * Audit log of each cron firing. Lets the UI show "last 5 runs" + total
 * cost incurred + which brands succeeded vs failed.
 */
export const SCHEDULED_RUN_STATUSES = [
  "running",
  "success",
  "partial", // some sub-tasks failed
  "failed",
] as const;
export type ScheduledRunStatus = (typeof SCHEDULED_RUN_STATUSES)[number];

export const scheduledRunsTable = pgTable(
  "scheduled_runs",
  {
    id: serial("id").primaryKey(),
    jobKey: text("job_key").notNull(),
    status: text("status").$type<ScheduledRunStatus>().notNull(),
    /** Whether this firing was triggered by cron or by a manual button click. */
    trigger: text("trigger").$type<"cron" | "manual">().notNull(),
    /** Per-run summary: brand list, totals, errors. Schema-free for flexibility. */
    summary: jsonb("summary").$type<Record<string, unknown>>(),
    /** Full output payload (e.g. the formatted Telegram message). */
    payload: text("payload"),
    totalCostEur: decimal("total_cost_eur", { precision: 10, scale: 4 }),
    brandsProcessed: integer("brands_processed").default(0).notNull(),
    brandsFailed: integer("brands_failed").default(0).notNull(),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (table) => ({
    jobKeyIdx: index("idx_scheduled_runs_job_key").on(
      table.jobKey,
      table.startedAt,
    ),
    statusCheck: check(
      "scheduled_runs_status_check",
      sql`${table.status} IN ('running', 'success', 'partial', 'failed')`,
    ),
    triggerCheck: check(
      "scheduled_runs_trigger_check",
      sql`${table.trigger} IN ('cron', 'manual')`,
    ),
  }),
);

export type ScheduledRun = typeof scheduledRunsTable.$inferSelect;
export type InsertScheduledRun = typeof scheduledRunsTable.$inferInsert;
