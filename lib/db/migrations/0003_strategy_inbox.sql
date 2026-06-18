-- ============================================================================
-- Phase B — Strategy Inbox
-- ============================================================================
-- Adds strategy_inbox: ad-hoc campaign ideas / company goals / format tests /
-- feedback that Claude analyses (feasibility, timeline, resources, risks,
-- recommended week). brand_id is NULLABLE (null = applies to all brands).
--
-- Additive only. Safe on populated prod DB.
--
-- Apply:
--   psql "$DATABASE_URL" -f lib/db/migrations/0003_strategy_inbox.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "strategy_inbox" (
  "id"                    serial      PRIMARY KEY,
  "brand_id"              integer     REFERENCES "brands"("id") ON DELETE CASCADE,
  "input_type"           text        NOT NULL,
  "content"               text        NOT NULL,
  "priority"              text        NOT NULL DEFAULT 'medium',
  "deadline"              date,
  "claude_analysis"       jsonb,
  "status"                text        NOT NULL DEFAULT 'pending',
  "incorporated_in_week"  integer,
  "tokens_input"          integer,
  "tokens_output"         integer,
  "created_at"            timestamp   NOT NULL DEFAULT now(),
  "updated_at"            timestamp   NOT NULL DEFAULT now()
);

ALTER TABLE "strategy_inbox"
  DROP CONSTRAINT IF EXISTS "strategy_inbox_input_type_check";
ALTER TABLE "strategy_inbox"
  ADD CONSTRAINT "strategy_inbox_input_type_check"
  CHECK ("input_type" IN ('campaign_idea', 'company_goal', 'format_test', 'feedback', 'other'));

ALTER TABLE "strategy_inbox"
  DROP CONSTRAINT IF EXISTS "strategy_inbox_priority_check";
ALTER TABLE "strategy_inbox"
  ADD CONSTRAINT "strategy_inbox_priority_check"
  CHECK ("priority" IN ('high', 'medium', 'low'));

ALTER TABLE "strategy_inbox"
  DROP CONSTRAINT IF EXISTS "strategy_inbox_status_check";
ALTER TABLE "strategy_inbox"
  ADD CONSTRAINT "strategy_inbox_status_check"
  CHECK ("status" IN ('pending', 'analyzed', 'incorporated', 'archived'));

CREATE INDEX IF NOT EXISTS "idx_strategy_inbox_brand_status"
  ON "strategy_inbox" ("brand_id", "status");
CREATE INDEX IF NOT EXISTS "idx_strategy_inbox_created_at"
  ON "strategy_inbox" ("created_at");

COMMIT;
