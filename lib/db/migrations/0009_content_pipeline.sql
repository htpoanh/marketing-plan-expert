-- ============================================================================
-- Phase F — Content Pipeline (extend content_plans)
-- ============================================================================
-- Adds pipeline columns. image_prompt / video_prompt / image_url already exist.
-- Additive only — safe on populated DB.
-- ============================================================================

BEGIN;

ALTER TABLE "content_plans" ADD COLUMN IF NOT EXISTS "ai_reasoning" text;
ALTER TABLE "content_plans" ADD COLUMN IF NOT EXISTS "trend_source" text;
ALTER TABLE "content_plans" ADD COLUMN IF NOT EXISTS "strategy_inbox_id" integer;
ALTER TABLE "content_plans" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE "content_plans" ADD COLUMN IF NOT EXISTS "metricool_post_id" text;
ALTER TABLE "content_plans" ADD COLUMN IF NOT EXISTS "scheduled_date" timestamp;
ALTER TABLE "content_plans" ADD COLUMN IF NOT EXISTS "week_number" integer;
ALTER TABLE "content_plans" ADD COLUMN IF NOT EXISTS "kol_character_id" integer;
ALTER TABLE "content_plans" ADD COLUMN IF NOT EXISTS "ads_suitable" boolean DEFAULT false;

COMMIT;
