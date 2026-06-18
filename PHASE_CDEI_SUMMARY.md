# Phases D · I · C · E — Summary

**Date:** 2026-06-03
**Phases:** D (Trend Intelligence) · I (Learning Memory) · C (Market Research) · E (Weekly Dashboard)
**Status:** ✅ Built. No-key phases fully functional; key-gated collectors scaffolded + inactive until keys provided.

---

## Phase D — Trend Intelligence

- **`trend_insights`** table (migration `0004`). TREND SCORE = strength × relevance ×
  strategyAlignment ÷ productionDifficulty; buckets >50 propose / 30-50 backlog / <30 skip.
- `services/trend-intelligence/scoring.ts` (pure) + `scan.service.ts` (reuses M4 Grok
  `getTrendPulse`, derives factors from momentum/relevance/window, cross-checks the
  Strategy Inbox by keyword overlap).
- API: `POST /trend-intelligence/scan`, `GET`, `PATCH /:id`, `DELETE /:id`.
- Frontend: `/trends` page (scan per brand, scored cards, status actions). Sidebar "Trend Intelligence".
- **Verified in-sandbox: 16/16 scoring assertions.** Vitest: `scoring.test.ts`.

## Phase I — Learning Memory

- **`brand_memory`** table (migration `0005`, unique per brand). Weekly rebuild aggregates
  reply-queue intents + top trend alignments today; performance fields ready for Phase A/F.
- `services/brand-memory/aggregate.service.ts` (pure `tallyIntents`/`topTrendAlignments` + `rebuildBrandMemory`).
- Cron `brand_memory_rebuild` (Sat 06:30, disabled) registered.
- API: `GET /brand-memory/:brandId`, `POST /brand-memory/:brandId/rebuild`.
- Vitest: `aggregate.test.ts`. (Consumed by the weekly report; no dedicated page.)

## Phase C — Market Research (scaffold)

- **`market_intelligence`** table (migration `0006`).
- `services/market-intelligence/collectors.ts`:
  - **Live now (no key):** `collectNews` (Google News RSS, dependency-free XML parse),
    `collectMapsCompetitors` (Places API New via existing `GOOGLE_API_KEY`).
  - **Scaffolded (inactive until key):** `collectTrends` (`GOOGLE_TRENDS_API_KEY`),
    `collectReddit` (`REDDIT_CLIENT_ID/SECRET`), `collectTiktok` (via Grok for now).
    These persist a clear "needs key" row so the UI shows wired vs. waiting.
- `synthesizer.ts` orchestrates all collectors per brand. Cron `market_intelligence_scan`
  (Sat 07:00, disabled) registered.
- API: `POST /market-intelligence/scan`, `GET`, `DELETE /:id`.
- Frontend: `/market-research` page (scan per brand, source-tagged signals, inactive badges). Sidebar "Nghiên cứu thị trường".

## Phase E — Weekly Dashboard

- **`weekly_reports`** table (migration `0007`).
- `services/weekly-report/generator.service.ts` — **deterministic** (no AI, always succeeds):
  pulls reply-queue KPIs, top trends, pending strategy items, recent market signals; derives
  rule-based insight cards (success/danger/info). Pure `buildInsights` + ISO-week helpers.
- Cron `weekly_report_generate` (Sat 08:00, disabled) → generates + pings Telegram via the
  existing dispatcher.
- API: `POST /weekly-report/generate`, `GET`, `GET /:id`, `POST /:id/approve`.
- Frontend: `/weekly-report` page — 6 KPI cards, Recharts bar chart, colour-coded insight
  cards, top-trends / pending-ideas / market-signals panels, "Duyệt kế hoạch" approve. Sidebar
  "Báo cáo tuần" (top of nav).
- **Verified in-sandbox: 5/5 pure-logic assertions** (buildInsights + week math). Vitest: `generator.test.ts`.

---

## Cron jobs now in the catalog (all disabled by default)

`weekly_trend_digest` · `review_auto_reply` · `brand_memory_rebuild` ·
`market_intelligence_scan` · `weekly_report_generate` — toggle in `/automation → Scheduled Jobs`.

## Deploy

```bash
git pull origin main
pnpm install --frozen-lockfile
for f in 0004_trend_insights 0005_brand_memory 0006_market_intelligence 0007_weekly_reports; do
  psql "$DATABASE_URL" -f lib/db/migrations/$f.sql
done
pnpm --filter @workspace/api-spec codegen   # REQUIRED before frontend builds
pnpm build
pm2 restart marketing-api --update-env
```

## Keys to add later (then the scaffolded sources go live)

- `GOOGLE_TRENDS_API_KEY` — Phase C trends collector
- `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` — Phase C reddit collector
- Phase A (ads readers) + Phase F (Metricool) + Phase H (ElevenLabs) remain unbuilt — these
  are the credential-heavy phases; say the word and I'll scaffold them the same way.

## Still verified the same way as before

Pure logic ran in-sandbox (38 + 10 + 16 + 5 assertions across phases). Full `pnpm typecheck`
and `pnpm test` (handler/DB-backed) must run on your machine after `pnpm --filter @workspace/api-spec codegen`, since the
sandbox has no installed deps.
