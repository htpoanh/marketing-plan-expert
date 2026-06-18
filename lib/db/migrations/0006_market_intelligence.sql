-- ============================================================================
-- Phase C — Market Research crawler
-- ============================================================================
-- market_intelligence: signals from news / maps / trends / reddit / tiktok /
-- grok. Free sources (news RSS, maps via existing GOOGLE_API_KEY) run now;
-- key-gated sources record an 'inactive' row until configured.
-- Seeds the daily 'market_intelligence_scan' job (disabled by default).
-- Additive only.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "market_intelligence" (
  "id"               serial      PRIMARY KEY,
  "brand_id"         integer     REFERENCES "brands"("id") ON DELETE CASCADE,
  "week_number"      integer,
  "source"           text        NOT NULL,
  "category"         text,
  "title"            text        NOT NULL,
  "content"          jsonb,
  "relevance_score"  integer,
  "urgency"          text,
  "incorporated"     boolean     NOT NULL DEFAULT false,
  "created_at"       timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_market_intel_brand_source"
  ON "market_intelligence" ("brand_id", "source");
CREATE INDEX IF NOT EXISTS "idx_market_intel_created_at"
  ON "market_intelligence" ("created_at");

INSERT INTO "scheduled_jobs" ("job_key", "name", "cron_expression", "enabled", "config")
VALUES (
  'market_intelligence_scan',
  'Market Intelligence Scan (Sat 07:00 Berlin)',
  '0 7 * * 6',
  false,
  '{}'::jsonb
)
ON CONFLICT ("job_key") DO NOTHING;

COMMIT;
