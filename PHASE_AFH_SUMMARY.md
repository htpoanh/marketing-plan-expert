# Phases A · F · H — Summary (scaffold, keys-later)

**Date:** 2026-06-03
**Phases:** A (Ads Performance Reader) · F (Content Pipeline) · H (Virtual KOL)
**Status:** ✅ Built as scaffolds. Text/AI parts work now (Claude); media/ads/push are env-gated and report "needs key" until credentials are added — server boots fine without them.

> Design note: the new platform clients (TikTok/Google Ads, Metricool, ElevenLabs)
> live under `services/<phase>/` as **lazy, env-gated stubs** rather than new
> `lib/integrations-*` workspace packages, to avoid 12+ files of package scaffolding
> for inactive code. They can be promoted to lib packages when keys land.

---

## Phase A — Ads Performance Reader

- **`ads_performance` + `ads_proposals`** tables (migration `0008`).
- `services/ads-analysis/readers.ts` — `readFacebookAds` / `readTiktokAds` / `readGoogleAds`,
  each lazily checks env keys and returns `{active:false, reason}` when missing (never throws at boot).
- `services/ads-analysis/budget-optimizer.ts` (pure) — `suggestReallocation` + `crossPlatformSummary`
  (spend-weighted blended ROAS); works on whatever rows exist (live or manual).
- API: `POST /ads-performance/scan`, `GET /ads-performance`, `GET /ads-performance/summary`.
- Cron `ads_performance_pull` (Sat 07:30, disabled). Frontend `/ads-performance` (KPI cards, reallocation hint, table). Sidebar "Hiệu quả quảng cáo".
- **Verified in-sandbox: 6/6 optimizer assertions.** Vitest: `budget-optimizer.test.ts`.
- **Keys:** `FACEBOOK_ADS_ACCESS_TOKEN`+`FACEBOOK_ADS_ACCOUNT_ID`, `TIKTOK_ADS_ACCESS_TOKEN`+`TIKTOK_ADVERTISER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN`+`GOOGLE_ADS_CUSTOMER_ID`+`GOOGLE_ADS_REFRESH_TOKEN`. Live-pull bodies are marked `TODO(keys)` in `readers.ts`.

## Phase F — Content Pipeline

- `content_plans` extended (migration `0009`): `ai_reasoning`, `trend_source`, `strategy_inbox_id`,
  `video_url`, `metricool_post_id`, `scheduled_date`, `week_number`, `kol_character_id`, `ads_suitable`.
- `services/content-pipeline/brand-dna.ts` (pure) — the 6 brand visual identities (Paradise fingertips-only,
  Happy Wok steaming wok, Taki dark/gold, Hafencafé Bodensee, etc.).
- `generate.service.ts` — Claude writes German caption (≤150 chars) + image/video prompts baking in the
  Brand DNA + voice. `metricool-push.ts` — env-gated draft push (per-brand blog id).
- API: `POST /content-pipeline/generate` (persists a `content_plans` draft, optional Metricool push).
- Frontend `/content-studio` (brand + topic → caption/hashtags/prompts + Metricool toggle). Sidebar "Content Studio".
- **Verified in-sandbox: 5/5 brand-dna assertions.**
- **Keys:** `METRICOOL_API_TOKEN`, `METRICOOL_USER_ID`, `METRICOOL_BLOG_ID_*` (image/video gen uses your existing OpenAI/Gemini keys; live Metricool POST marked `TODO(keys)`).

## Phase H — Virtual KOL

- **`kol_characters` (+ 3 seeded: Thái An, Pearl, Felix) + `kol_posts` + `kol_interactions`** (migration `0010`).
- `services/virtual-kol/generate.service.ts` — Claude writes in-character German script + caption;
  **EU AI Act disclosure** (`#KICharakter #AIFigur`) appended deterministically to every caption.
  `elevenlabs.ts` — env-gated TTS stub (per-character voice id).
- API: `GET /virtual-kol/characters`, `GET /virtual-kol/posts`, `POST /virtual-kol/generate`.
- Frontend `/kol` (character cards, generate, post list with audio/disclosure state). Sidebar "Virtual KOL".
- **Keys:** `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_THAI_AN` / `_PEARL` / `_FELIX`. Live TTS marked `TODO(keys)`.

---

## Deploy

```bash
git pull origin main
pnpm install --frozen-lockfile
for f in 0008_ads_performance 0009_content_pipeline 0010_virtual_kol; do
  psql "$DATABASE_URL" -f lib/db/migrations/$f.sql
done
pnpm --filter @workspace/api-spec codegen   # REQUIRED before frontend builds
pnpm build
pm2 restart marketing-api --update-env
```

## Where to drop the keys

When you have them, set the env vars above and replace the `throw new Error("... TODO(keys)")`
lines in `readers.ts` / `metricool-push.ts` / `elevenlabs.ts` with the real API calls (the request
shapes are already documented inline). No schema/UI changes needed — the inactive states flip to live.

---

## v3.0 system status — ALL 9 phases now built

A · B · C · D · E · F · G · H · I. Pure-logic verified in-sandbox across phases
(38 + 10 + 16 + 5 + 6 + 5 = 85 assertions). Full `pnpm typecheck` + `pnpm test` +
`pnpm --filter @workspace/api-spec codegen` must run on your machine (sandbox has no installed deps). 11 migrations
(`0000`–`0010`), 22 API routers, 6 cron jobs (all disabled by default).
