-- ============================================================================
-- Phase D — Trend Intelligence Engine
-- ============================================================================
-- trend_insights: scored, persisted trends.
--   TREND SCORE = strength × relevance × strategyAlignment ÷ productionDifficulty
-- Additive only. Apply:
--   psql "$DATABASE_URL" -f lib/db/migrations/0004_trend_insights.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "trend_insights" (
  "id"                       serial        PRIMARY KEY,
  "brand_id"                 integer       REFERENCES "brands"("id") ON DELETE CASCADE,
  "trend_name"               text          NOT NULL,
  "description"              text,
  "source"                   text,
  "trend_score"              numeric(6, 1) NOT NULL,
  "factors"                  jsonb,
  "momentum"                 text,
  "estimated_window_days"    integer,
  "suggested_angle"          text,
  "suggested_keywords"       jsonb,
  "strategy_alignment_note"  text,
  "recommended_action"       text,
  "status"                   text          NOT NULL DEFAULT 'new',
  "week_number"              integer,
  "created_at"               timestamp     NOT NULL DEFAULT now(),
  "updated_at"               timestamp     NOT NULL DEFAULT now()
);

ALTER TABLE "trend_insights"
  DROP CONSTRAINT IF EXISTS "trend_insights_status_check";
ALTER TABLE "trend_insights"
  ADD CONSTRAINT "trend_insights_status_check"
  CHECK ("status" IN ('new', 'proposed', 'backlog', 'skipped', 'actioned'));

CREATE INDEX IF NOT EXISTS "idx_trend_insights_brand_status"
  ON "trend_insights" ("brand_id", "status");
CREATE INDEX IF NOT EXISTS "idx_trend_insights_score"
  ON "trend_insights" ("trend_score");

COMMIT;
