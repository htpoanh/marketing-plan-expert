-- ============================================================================
-- Phase A — Ads Performance Reader
-- ============================================================================
-- ads_performance: weekly pulls per brand × platform (facebook/tiktok/google).
-- ads_proposals: budget-reallocation suggestions for weekly approval.
-- Seeds the weekly 'ads_performance_pull' job (disabled by default).
-- Additive only.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "ads_performance" (
  "id"               serial         PRIMARY KEY,
  "brand_id"         integer        NOT NULL REFERENCES "brands"("id") ON DELETE CASCADE,
  "platform"         text           NOT NULL,
  "week_start"       date,
  "spend_eur"        numeric(10, 2),
  "reach"            integer,
  "impressions"      integer,
  "clicks"           integer,
  "ctr"              numeric(5, 4),
  "cpm"              numeric(10, 2),
  "cpc"              numeric(10, 2),
  "roas"             numeric(10, 2),
  "top_creative_id"  text,
  "raw_data"         jsonb,
  "created_at"       timestamp      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ads_perf_brand_platform"
  ON "ads_performance" ("brand_id", "platform");
CREATE INDEX IF NOT EXISTS "idx_ads_perf_week"
  ON "ads_performance" ("week_start");

CREATE TABLE IF NOT EXISTS "ads_proposals" (
  "id"                    serial         PRIMARY KEY,
  "weekly_report_id"      integer,
  "brand_id"              integer        NOT NULL REFERENCES "brands"("id") ON DELETE CASCADE,
  "platform"              text           NOT NULL,
  "campaign_type"         text,
  "budget_eur"            numeric(10, 2),
  "budget_change_reason"  text,
  "targeting"             jsonb,
  "creative_post_id"      integer,
  "expected_reach"        integer,
  "status"                text           NOT NULL DEFAULT 'proposed',
  "user_notes"            text,
  "created_at"            timestamp      NOT NULL DEFAULT now()
);

INSERT INTO "scheduled_jobs" ("job_key", "name", "cron_expression", "enabled", "config")
VALUES (
  'ads_performance_pull',
  'Ads Performance Pull (Sat 07:30 Berlin)',
  '30 7 * * 6',
  false,
  '{}'::jsonb
)
ON CONFLICT ("job_key") DO NOTHING;

COMMIT;
