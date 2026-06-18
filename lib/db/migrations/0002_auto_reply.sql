-- ============================================================================
-- Phase G — Auto-Reply Engine
-- ============================================================================
-- Adds:
--   reply_queue           — unified inbox row per inbound interaction across
--                           Google reviews + FB/IG comments + Messenger
--   auto_reply_settings   — per-brand toggles + safety guards (daily cap,
--                           escalate threshold). Missing row = fully disabled.
--   scheduled_jobs seed   — hourly 'review_auto_reply' job, DISABLED by default
--
-- Additive only — no existing table is touched. Safe on populated prod DB.
--
-- Apply:
--   psql "$DATABASE_URL" -f lib/db/migrations/0002_auto_reply.sql
-- or:
--   pnpm --filter @workspace/db run migrate
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "reply_queue" (
  "id"               serial         PRIMARY KEY,
  "brand_id"         integer        NOT NULL REFERENCES "brands"("id") ON DELETE CASCADE,
  "platform"         text           NOT NULL,
  "external_id"      text,
  "review_id"        integer,
  "author_name"      text,
  "rating"           integer,
  "original_message" text,
  "suggested_reply"  text,
  "reply_mode"       text,
  "intent"           text,
  "sentiment"        numeric(3, 2),
  "status"           text           NOT NULL DEFAULT 'pending',
  "status_reason"    text,
  "sent_reply"       text,
  "sent_at"          timestamp,
  "created_at"       timestamp      NOT NULL DEFAULT now(),
  "updated_at"       timestamp      NOT NULL DEFAULT now()
);

ALTER TABLE "reply_queue"
  DROP CONSTRAINT IF EXISTS "reply_queue_platform_check";
ALTER TABLE "reply_queue"
  ADD CONSTRAINT "reply_queue_platform_check"
  CHECK ("platform" IN ('google', 'facebook', 'instagram', 'messenger'));

ALTER TABLE "reply_queue"
  DROP CONSTRAINT IF EXISTS "reply_queue_status_check";
ALTER TABLE "reply_queue"
  ADD CONSTRAINT "reply_queue_status_check"
  CHECK ("status" IN ('pending', 'auto_sent', 'manual_sent', 'escalated', 'skipped'));

CREATE INDEX IF NOT EXISTS "idx_reply_queue_brand_status"
  ON "reply_queue" ("brand_id", "status");
CREATE INDEX IF NOT EXISTS "idx_reply_queue_platform"
  ON "reply_queue" ("platform");
CREATE INDEX IF NOT EXISTS "idx_reply_queue_created_at"
  ON "reply_queue" ("created_at");

CREATE TABLE IF NOT EXISTS "auto_reply_settings" (
  "id"                  serial      PRIMARY KEY,
  "brand_id"            integer     NOT NULL UNIQUE REFERENCES "brands"("id") ON DELETE CASCADE,
  "google_enabled"      boolean     NOT NULL DEFAULT false,
  "fb_comments_enabled" boolean     NOT NULL DEFAULT false,
  "ig_comments_enabled" boolean     NOT NULL DEFAULT false,
  "daily_cap"           integer     NOT NULL DEFAULT 50,
  "escalate_threshold"  integer     NOT NULL DEFAULT 2,
  "created_at"          timestamp   NOT NULL DEFAULT now(),
  "updated_at"          timestamp   NOT NULL DEFAULT now()
);

-- Seed the hourly review auto-reply job (disabled by default so production
-- never starts replying to live Google reviews without the user opting in).
INSERT INTO "scheduled_jobs" ("job_key", "name", "cron_expression", "enabled", "config")
VALUES (
  'review_auto_reply',
  'Google Review Auto-Reply (hourly)',
  '0 * * * *',
  false,
  '{}'::jsonb
)
ON CONFLICT ("job_key") DO NOTHING;

COMMIT;
