-- ============================================================================
-- Phase 5a — scheduling layer
-- ============================================================================
-- Adds two tables for cron-driven background jobs:
--   scheduled_jobs   — catalog of recurring jobs the api-server runs (one
--                      row per unique cron job key, e.g. 'weekly_trend_digest')
--   scheduled_runs   — audit log of each firing (cron or manual)
--
-- Additive only — no existing table is touched. Safe on populated prod DB.
--
-- Apply:
--   psql "$DATABASE_URL" -f lib/db/migrations/0001_scheduled_jobs.sql
-- or:
--   pnpm --filter @workspace/db run migrate
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
  "id"               serial      PRIMARY KEY,
  "job_key"          text        NOT NULL UNIQUE,
  "name"             text        NOT NULL,
  "cron_expression"  text        NOT NULL,
  "enabled"          boolean     NOT NULL DEFAULT false,
  "config"           jsonb,
  "last_run_at"      timestamp,
  "next_run_at"      timestamp,
  "created_at"       timestamp   NOT NULL DEFAULT now(),
  "updated_at"       timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "scheduled_runs" (
  "id"                serial         PRIMARY KEY,
  "job_key"           text           NOT NULL,
  "status"            text           NOT NULL,
  "trigger"           text           NOT NULL,
  "summary"           jsonb,
  "payload"           text,
  "total_cost_eur"    numeric(10, 4),
  "brands_processed"  integer        NOT NULL DEFAULT 0,
  "brands_failed"     integer        NOT NULL DEFAULT 0,
  "duration_ms"       integer,
  "error_message"     text,
  "started_at"        timestamp      NOT NULL DEFAULT now(),
  "finished_at"       timestamp
);

ALTER TABLE "scheduled_runs"
  DROP CONSTRAINT IF EXISTS "scheduled_runs_status_check";
ALTER TABLE "scheduled_runs"
  ADD CONSTRAINT "scheduled_runs_status_check"
  CHECK ("status" IN ('running', 'success', 'partial', 'failed'));

ALTER TABLE "scheduled_runs"
  DROP CONSTRAINT IF EXISTS "scheduled_runs_trigger_check";
ALTER TABLE "scheduled_runs"
  ADD CONSTRAINT "scheduled_runs_trigger_check"
  CHECK ("trigger" IN ('cron', 'manual'));

CREATE INDEX IF NOT EXISTS "idx_scheduled_runs_job_key"
  ON "scheduled_runs" ("job_key", "started_at" DESC);

-- Seed the catalog with the weekly trend digest job (disabled by default
-- so production never starts running it without the user opting in).
INSERT INTO "scheduled_jobs" ("job_key", "name", "cron_expression", "enabled", "config")
VALUES (
  'weekly_trend_digest',
  'Weekly Trend Digest (Sunday 8:00 Berlin)',
  '0 8 * * 0',
  false,
  '{}'::jsonb
)
ON CONFLICT ("job_key") DO NOTHING;

COMMIT;
