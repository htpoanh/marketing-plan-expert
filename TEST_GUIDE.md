# Test Guide — v3.0 Phases A–I (for Claude Code)

This branch adds the full "Unified AI Marketing Manager" (phases A, B, C, D, E, F, G, H, I)
on top of the existing Ads Strategy Agent. Everything was authored in Cowork without an
installed dependency tree, so **the first job is `pnpm --filter @workspace/api-spec codegen` + typecheck + tests**.

Project root: `/Users/phuongoanhwaldegger/Documents/PW-Projects/marketing/marketing-plan-expert`

---

## 0. CRITICAL — run in this exact order

```bash
cd /Users/phuongoanhwaldegger/Documents/PW-Projects/marketing/marketing-plan-expert

# 1. Install (new dev deps already used by existing phases; nothing new added)
pnpm install

# 2. REGENERATE API CLIENT — REQUIRED. The 8 new frontend pages import hooks that
#    only exist after Orval runs against the updated openapi.yaml.
pnpm --filter @workspace/api-spec codegen

# 3. Typecheck every workspace (this is where any type mismatch will surface)
pnpm -r typecheck   # or: pnpm --filter @workspace/api-server typecheck etc.

# 4. Run the api-server test suite (existing 70 + new pure-logic suites)
pnpm --filter @workspace/api-server test

# 5. Build
pnpm build
```

If step 2 is skipped, the frontend will not typecheck/build (missing generated hooks).

---

## 1. New DB migrations (additive, idempotent — apply against a TEST db first)

```
lib/db/migrations/0002_auto_reply.sql          # Phase G: reply_queue, auto_reply_settings (+ job seed)
lib/db/migrations/0003_strategy_inbox.sql       # Phase B
lib/db/migrations/0004_trend_insights.sql       # Phase D
lib/db/migrations/0005_brand_memory.sql         # Phase I (+ job seed)
lib/db/migrations/0006_market_intelligence.sql  # Phase C (+ job seed)
lib/db/migrations/0007_weekly_reports.sql       # Phase E (+ job seed)
lib/db/migrations/0008_ads_performance.sql      # Phase A (+ job seed)
lib/db/migrations/0009_content_pipeline.sql     # Phase F (ALTER content_plans, ADD COLUMN IF NOT EXISTS)
lib/db/migrations/0010_virtual_kol.sql          # Phase H (+ seeds 3 characters)
```

Apply: `for f in 0002 0003 0004 0005 0006 0007 0008 0009 0010; do psql "$DATABASE_URL" -f lib/db/migrations/${f}_*.sql; done`
All use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` and touch no existing columns destructively.

---

## 2. New Drizzle schema files (verify they compile + match migrations)

```
lib/db/src/schema/reply_queue.ts          auto_reply_settings.ts     strategy_inbox.ts
lib/db/src/schema/trend_insights.ts       brand_memory.ts            market_intelligence.ts
lib/db/src/schema/weekly_reports.ts       ads_performance.ts         kol.ts
```
Modified: `lib/db/src/schema/index.ts` (barrel exports), `content_plans.ts` (Phase F columns).

---

## 3. Backend — new routers (mounted in `routes/index.ts`) + services

| Route prefix | Router | Services | Pure-logic tests |
|---|---|---|---|
| `/api/auto-reply` (G) | `routes/auto-reply/` | `services/auto-reply/` | `intent-classifier.test.ts`, `reply-rules.test.ts`, `guards.test.ts`, `brand-voice.test.ts` |
| `/api/strategy-inbox` (B) | `routes/strategy-inbox/` | `services/strategy-inbox/` | `prompt.test.ts`, `output-validator.test.ts` |
| `/api/trend-intelligence` (D) | `routes/trend-intelligence/` | `services/trend-intelligence/` | `scoring.test.ts` |
| `/api/brand-memory` (I) | `routes/brand-memory/` | `services/brand-memory/` | `aggregate.test.ts` |
| `/api/market-intelligence` (C) | `routes/market-intelligence/` | `services/market-intelligence/` | — |
| `/api/weekly-report` (E) | `routes/weekly-report/` | `services/weekly-report/` | `generator.test.ts` |
| `/api/ads-performance` (A) | `routes/ads-performance/` | `services/ads-analysis/` | `budget-optimizer.test.ts` |
| `/api/content-pipeline` (F) | `routes/content-pipeline/` | `services/content-pipeline/` | — |
| `/api/virtual-kol` (H) | `routes/virtual-kol/` | `services/virtual-kol/` | — |

Modified backend: `routes/index.ts` (mounts), `jobs/scheduler.ts` (5 new JOB_RUNNERS),
`routes/messenger.ts` (FB/IG comment webhook → `services/auto-reply/comment-handler`),
`routes/reviews.ts` (exported `syncGmbForBrand` for the review auto-reply job).

New cron jobs (all **disabled by default** in `scheduled_jobs`): `review_auto_reply`,
`brand_memory_rebuild`, `market_intelligence_scan`, `weekly_report_generate`, `ads_performance_pull`.

---

## 4. Frontend — new pages (routes in `App.tsx`, nav in `Sidebar.tsx`)

```
/weekly-report   pages/weekly-report/WeeklyReportPage.tsx     (E)
/ads-performance pages/ads-performance/AdsPerformancePage.tsx (A)
/strategy-inbox  pages/strategy-inbox/                         (B)
/trends          pages/trends/TrendIntelligencePage.tsx        (D)
/market-research pages/market-research/MarketResearchPage.tsx  (C)
/content-studio  pages/content-studio/ContentStudioPage.tsx    (F)
/kol             pages/kol/VirtualKolPage.tsx                   (H)
/inbox           pages/inbox/                                   (G)
```

---

## 5. Live HTTP smoke (after migrations, with a logged-in session cookie)

```bash
# No-key phases work end-to-end with AI keys present:
curl -sb cookies.txt -XPOST localhost:PORT/api/strategy-inbox \
  -H 'content-type: application/json' \
  -d '{"inputType":"campaign_idea","content":"Sommer Aktion testen","priority":"high"}'        # 201 + claudeAnalysis

curl -sb cookies.txt -XPOST localhost:PORT/api/trend-intelligence/scan \
  -H 'content-type: application/json' -d '{"brandId":2}'                                         # needs GROK key
curl -sb cookies.txt -XPOST localhost:PORT/api/weekly-report/generate                           # 201 (deterministic, no AI)
curl -sb cookies.txt localhost:PORT/api/brand-memory/2 ; echo                                    # 404 until rebuilt

# Key-gated phases report inactive cleanly (NO crash) without keys:
curl -sb cookies.txt -XPOST localhost:PORT/api/ads-performance/scan \
  -H 'content-type: application/json' -d '{"brandId":2}'        # statuses[].active:false, reason: missing envs
curl -sb cookies.txt -XPOST localhost:PORT/api/market-intelligence/scan \
  -H 'content-type: application/json' -d '{"brandId":2}'        # news+maps active if GOOGLE_API_KEY set; others inactive
```

---

## 6. Known things to scrutinise during review

1. **Orval hook names** — frontend imports assume operationId→hook mapping
   (e.g. `useListReplyQueue`, `useScanTrendIntelligence`, `useGenerateKolPost`). If Orval names
   anything differently, fix the import in the matching page. This is the single most likely break.
2. **`messenger.ts` uses `any`** for raw Meta webhook payloads (consistent with the existing file's style).
3. **IG comment → brand mapping** falls back to the first active config (`messenger_configs` has no IG id column).
4. **Key-gated stubs** in `services/ads-analysis/readers.ts`, `content-pipeline/metricool-push.ts`,
   `virtual-kol/elevenlabs.ts` throw `TODO(keys)` only when keys ARE present (live call unwired);
   they return `{active:false}` when keys are absent.
5. **Verified pure-logic in Cowork (85 assertions):** auto-reply (38), strategy-inbox prompt (10),
   trend scoring (16), weekly-report (5), budget-optimizer (6), brand-dna (5). Vitest files exist for
   most; `pnpm test` should confirm.

Per-phase detail: `PHASE_G_SUMMARY.md`, `PHASE_B_SUMMARY.md`, `PHASE_CDEI_SUMMARY.md`, `PHASE_AFH_SUMMARY.md`.
