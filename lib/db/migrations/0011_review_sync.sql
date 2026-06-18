-- ============================================================================
-- Standalone Google Review Sync job
-- ============================================================================
-- Seeds the 'review_sync' scheduled job (disabled by default). Pulls the
-- latest Google Business Profile reviews for every connected brand, every 6
-- hours — independent of the auto-reply engine, so reviews stay fresh on the
-- dashboard even when auto-reply is off.
-- No new tables; reuses the existing reviews + scheduled_jobs/scheduled_runs.
-- Additive only.
-- ============================================================================

BEGIN;

INSERT INTO "scheduled_jobs" ("job_key", "name", "cron_expression", "enabled", "config")
VALUES (
  'review_sync',
  'Google Review Sync (alle 6 Stunden)',
  '0 */6 * * *',
  false,
  '{}'::jsonb
)
ON CONFLICT ("job_key") DO NOTHING;

COMMIT;
