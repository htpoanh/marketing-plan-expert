-- ============================================================================
-- Phase E — Weekly Meeting Dashboard
-- ============================================================================
-- weekly_reports: one row per generated weekly report (KPI + sections +
-- insights), reviewed/approved from /weekly-report. Seeds the
-- 'weekly_report_generate' job (Sat 08:00, disabled by default).
-- Additive only.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "weekly_reports" (
  "id"                 serial      PRIMARY KEY,
  "week_number"        integer     NOT NULL,
  "week_start"         date,
  "kpi_data"           jsonb,
  "sections"           jsonb,
  "trend_analysis"     text,
  "chat_log"           jsonb       DEFAULT '[]'::jsonb,
  "approved_by_user"   boolean     NOT NULL DEFAULT false,
  "auto_approved"      boolean     NOT NULL DEFAULT false,
  "approved_at"        timestamp,
  "telegram_sent"      boolean     NOT NULL DEFAULT false,
  "created_at"         timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_weekly_reports_week"
  ON "weekly_reports" ("week_number");
CREATE INDEX IF NOT EXISTS "idx_weekly_reports_created_at"
  ON "weekly_reports" ("created_at");

INSERT INTO "scheduled_jobs" ("job_key", "name", "cron_expression", "enabled", "config")
VALUES (
  'weekly_report_generate',
  'Weekly Report Generate (Sat 08:00 Berlin)',
  '0 8 * * 6',
  false,
  '{}'::jsonb
)
ON CONFLICT ("job_key") DO NOTHING;

COMMIT;
