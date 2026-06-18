-- ============================================================================
-- Phase H — Virtual KOL System
-- ============================================================================
-- kol_characters (+ seed 3), kol_posts, kol_interactions.
-- Additive only.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "kol_characters" (
  "id"            serial      PRIMARY KEY,
  "name"          text        NOT NULL,
  "handle"        text        NOT NULL,
  "brand_ids"     jsonb       DEFAULT '[]'::jsonb,
  "personality"   text,
  "voice_id"      text,
  "visual_seed"   text,
  "language"      text        DEFAULT 'de',
  "active"        boolean     NOT NULL DEFAULT true,
  "created_at"    timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "kol_posts" (
  "id"                 serial      PRIMARY KEY,
  "character_id"       integer     NOT NULL REFERENCES "kol_characters"("id") ON DELETE CASCADE,
  "content_plan_id"    integer,
  "script"             text,
  "caption"            text,
  "hashtags"           jsonb       DEFAULT '[]'::jsonb,
  "image_url"          text,
  "audio_url"          text,
  "video_url"          text,
  "metricool_post_id"  text,
  "status"             text        NOT NULL DEFAULT 'draft',
  "performance"        jsonb,
  "created_at"         timestamp   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_kol_posts_character" ON "kol_posts" ("character_id");

CREATE TABLE IF NOT EXISTS "kol_interactions" (
  "id"                    serial      PRIMARY KEY,
  "character_id"          integer     NOT NULL REFERENCES "kol_characters"("id") ON DELETE CASCADE,
  "platform"              text,
  "external_comment_id"   text,
  "incoming_message"      text,
  "generated_reply"       text,
  "sent"                  boolean     NOT NULL DEFAULT false,
  "created_at"            timestamp   NOT NULL DEFAULT now()
);

-- Seed the 3 characters (idempotent on handle via NOT EXISTS guard).
INSERT INTO "kol_characters" ("name", "handle", "personality", "language", "visual_seed")
SELECT 'Thái An', '@thaian.kocht', 'Phụ nữ Việt-Đức 28, ấm áp, yêu ẩm thực', 'de', '42'
WHERE NOT EXISTS (SELECT 1 FROM "kol_characters" WHERE "handle" = '@thaian.kocht');

INSERT INTO "kol_characters" ("name", "handle", "personality", "language", "visual_seed")
SELECT 'Pearl', '@pearl.nailsallgäu', 'Phụ nữ Châu Âu 25, trendy, nail expert', 'de', '87'
WHERE NOT EXISTS (SELECT 1 FROM "kol_characters" WHERE "handle" = '@pearl.nailsallgäu');

INSERT INTO "kol_characters" ("name", "handle", "personality", "language", "visual_seed")
SELECT 'Felix am See', '@felixamsee', 'Nam Đức 30, relaxed, yêu Bodensee lifestyle', 'de', '156'
WHERE NOT EXISTS (SELECT 1 FROM "kol_characters" WHERE "handle" = '@felixamsee');

COMMIT;
