-- ============================================================================
-- Ads Strategy Agent — Phase 1 bootstrap migration
-- ============================================================================
--
-- This is the FIRST migration file in the project. The codebase previously used
-- `drizzle-kit push` to sync schema directly. Going forward, schema changes go
-- through `pnpm --filter @workspace/db run generate` (or are written manually
-- like this one) and applied with `pnpm --filter @workspace/db run migrate`.
--
-- ALL CHANGES IN THIS FILE ARE ADDITIVE. No existing column is dropped, renamed
-- or retyped. Safe to apply on a populated production DB without data loss.
--
-- To apply manually:
--   psql "$DATABASE_URL" -f lib/db/migrations/0000_ads_strategy_bootstrap.sql
--
-- Or via Drizzle:
--   pnpm --filter @workspace/db run migrate
--
-- ============================================================================

BEGIN;

-- ── Extend brands table with ads_strategy context ────────────────────────────
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "ads_context" jsonb;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "service_radius_km" integer;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "avg_ticket_size_eur" numeric(10, 2);

-- ── Create ads_reports table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ads_reports" (
  "id"             serial       PRIMARY KEY,
  "brand_id"       integer      NOT NULL REFERENCES "brands"("id") ON DELETE CASCADE,
  "module"         text         NOT NULL,
  "input"          jsonb        NOT NULL,
  "output"         jsonb        NOT NULL,
  "ai_provider"    text         NOT NULL,
  "ai_model"       text         NOT NULL,
  "tokens_input"   integer,
  "tokens_output"  integer,
  "cost_eur"       numeric(10, 4),
  "latency_ms"     integer,
  "user_notes"     text,
  "created_at"     timestamp    NOT NULL DEFAULT now(),
  "updated_at"     timestamp    NOT NULL DEFAULT now()
);

-- Soft enum check (text + CHECK constraint avoids needing a dedicated pg type).
ALTER TABLE "ads_reports"
  DROP CONSTRAINT IF EXISTS "ads_reports_module_check";
ALTER TABLE "ads_reports"
  ADD CONSTRAINT "ads_reports_module_check"
  CHECK ("module" IN ('audience', 'keyword', 'performance', 'trend'));

ALTER TABLE "ads_reports"
  DROP CONSTRAINT IF EXISTS "ads_reports_provider_check";
ALTER TABLE "ads_reports"
  ADD CONSTRAINT "ads_reports_provider_check"
  CHECK ("ai_provider" IN ('anthropic', 'google', 'openai', 'xai'));

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_ads_reports_brand_module"
  ON "ads_reports" ("brand_id", "module");

CREATE INDEX IF NOT EXISTS "idx_ads_reports_created_at"
  ON "ads_reports" ("created_at" DESC);

COMMIT;
