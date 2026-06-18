-- ============================================================================
-- Phase I — Learning Memory
-- ============================================================================
-- brand_memory: one evolving row per brand, rebuilt weekly from available
-- signals (reply-queue intents, top trends; performance fields fill later).
-- Also seeds the weekly 'brand_memory_rebuild' job (disabled by default).
-- Additive only.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "brand_memory" (
  "id"                        serial      PRIMARY KEY,
  "brand_id"                  integer     NOT NULL UNIQUE REFERENCES "brands"("id") ON DELETE CASCADE,
  "version"                   integer     NOT NULL DEFAULT 1,
  "top_formats"               jsonb       DEFAULT '[]'::jsonb,
  "top_topics"                jsonb       DEFAULT '[]'::jsonb,
  "best_hours"                jsonb       DEFAULT '[]'::jsonb,
  "proven_hashtags"           jsonb       DEFAULT '[]'::jsonb,
  "top_intent_keywords"       jsonb       DEFAULT '[]'::jsonb,
  "trend_alignments"          jsonb       DEFAULT '[]'::jsonb,
  "audience_ica"              jsonb,
  "ads_performance_history"   jsonb       DEFAULT '[]'::jsonb,
  "updated_at"                timestamp   NOT NULL DEFAULT now()
);

INSERT INTO "scheduled_jobs" ("job_key", "name", "cron_expression", "enabled", "config")
VALUES (
  'brand_memory_rebuild',
  'Brand Memory Rebuild (Saturday 06:30 Berlin)',
  '30 6 * * 6',
  false,
  '{}'::jsonb
)
ON CONFLICT ("job_key") DO NOTHING;

COMMIT;
