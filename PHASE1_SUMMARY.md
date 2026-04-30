# Phase 1 — Foundation — Summary

**Date:** 2026-04-30
**Phase:** 1 of 4 (per `docs/UPGRADE_PLAN.md`)
**Status:** ✅ Backend foundation complete — UI lands in Phase 2

---

## What shipped

### 1. Database (decisions 1A keep integer brand_id, 7A switch to migrations)

**`lib/db/src/schema/brands.ts`** (additive only):
- `adsContext` JSONB (typed as `BrandAdsContext`)
- `serviceRadiusKm` integer
- `avgTicketSizeEur` decimal(10,2)

**`lib/db/src/schema/ads_reports.ts`** (new table):
- `id` serial PK
- `brandId` integer FK → brands ON DELETE CASCADE
- `module` text + CHECK in `(audience|keyword|performance|trend)`
- `input` JSONB — user-submitted form values + brand snapshot
- `output` JSONB — AI-generated, schema-validated result
- `aiProvider` text + CHECK in `(anthropic|google|openai|xai)`
- `aiModel` text
- `tokensInput`, `tokensOutput` integer
- `costEur` decimal(10,4)
- `latencyMs` integer
- `userNotes` text
- `createdAt`, `updatedAt` timestamp
- Indexes: `(brand_id, module)`, `(created_at DESC)`

**`lib/db/migrations/0000_ads_strategy_bootstrap.sql`** — first migration file, idempotent (`IF NOT EXISTS`), wrapped in `BEGIN/COMMIT`.

**Workflow change**: switched from `drizzle-kit push` to `drizzle-kit generate` + `migrate`. New scripts in `lib/db/package.json`: `generate`, `migrate`, `studio`. Documented in `lib/db/migrations/README.md`.

### 2. AI integration packages (decision 3A)

**New: `lib/integrations-openai`**
- `client.ts` — singleton OpenAI client; reads `AI_INTEGRATIONS_OPENAI_API_KEY` or `OPENAI_API_KEY`; optional `_BASE_URL` override
- `retry.ts` — `withRetry()` helper using `p-retry` with exponential backoff + jitter; `isRateLimitError()`, `isTransientError()` predicates

**New: `lib/integrations-xai`**
- `client.ts` — Grok client (OpenAI-compatible REST at `api.x.ai/v1`); reads `AI_INTEGRATIONS_XAI_API_KEY` or `GROK_API_KEY` or `XAI_API_KEY`
- `DEFAULT_GROK_MODEL = "grok-3"` constant

> Future refactor (defer to Phase 2 cleanup): replace inline `new OpenAI(...)` in `routes/{messenger,pipeline}.ts` with imports from these packages.

### 3. OpenAPI spec (decision 6A — append to single file)

Added 1 tag + 8 paths + 8 schemas:
- `POST /ads-strategy/audience` → `AdsReport`
- `POST /ads-strategy/keywords` → `AdsReport`
- `POST /ads-strategy/performance` → `AdsReport`
- `POST /ads-strategy/trend` → `AdsReport`
- `GET /ads-strategy/reports[?brandId&module&limit]` → `AdsReport[]`
- `GET /ads-strategy/reports/:id` → `AdsReport`
- `PATCH /ads-strategy/reports/:id` (body: `UpdateAdsReportBody`) → `AdsReport`
- `DELETE /ads-strategy/reports/:id` → 204
- `GET /ads-strategy/cost-summary[?brandId&since]` → `AdsCostBucket[]`

Ran Orval codegen → React Query hooks (`useGenerateAdsAudience`, `useListAdsReports`, etc.) and Zod schemas auto-generated.

### 4. Backend handlers (decision 2B — no service layer)

```
artifacts/api-server/src/routes/ads-strategy/
├── index.ts              mount modules + cost-summary + reports
├── modules.handler.ts    P1 stubs (501 Not Implemented) for 4 modules
├── modules.handler.test.ts  smoke tests (4/4 passing)
└── reports.handler.ts    full CRUD + cost-summary aggregator
```

Mounted on `/api/ads-strategy` in `routes/index.ts`. Inherits the existing `requireAdmin` session middleware — no new auth wiring needed.

### 5. Cleanup (decision 4A — replace old ad-analysis)

Deleted:
- `artifacts/api-server/src/routes/ad-analysis.ts` (GPT-4o, no DB persist, `any` types)
- `artifacts/marketing-platform/src/pages/analysis/AdAnalysis.tsx` (401 lines)

Replaced with:
- `artifacts/marketing-platform/src/pages/strategy/ads/AdsStrategyComingSoon.tsx` — placeholder landing page describing 4 modules
- Sidebar entry updated: "Phân tích quảng cáo" → "Ads Strategy AI" → `/strategy/ads`

### 6. Test infrastructure (decision 5A)

- `artifacts/api-server/vitest.config.ts` — node env, fork pool, workspace alias
- `artifacts/api-server/src/__tests__/setup.ts` — seeds safe test-only env vars
- New deps: `vitest@^3`, `supertest@^7`, `@types/supertest`
- Scripts: `pnpm test`, `pnpm test:watch`
- 4 smoke tests passing (one per module endpoint, asserting 501 + Phase 2 message)

---

## Test results

```
artifacts/api-server> pnpm test
 ✓ src/routes/ads-strategy/modules.handler.test.ts (4 tests) 14ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  299ms
```

## Typecheck

- `lib/db` ✅ clean (after fixing api-zod barrel-export collision)
- `lib/integrations-openai` ✅ clean
- `lib/integrations-xai` ✅ clean
- `artifacts/api-server` ✅ no NEW errors in `routes/ads-strategy/*` (pre-existing TS7030 across `routes/{ai-agents,ai-profiles,brands,...}` from before this PR — flagged in audit, out of scope)
- `artifacts/marketing-platform` ✅ no NEW errors in `pages/strategy/ads/*` (pre-existing errors elsewhere unchanged)

## Files changed

```
 21 files changed, 1067 insertions(+), 416 deletions(-)
 + 11 new files (schemas, integration packages, route handlers, test setup)
 - 2 deleted (ad-analysis route + AdAnalysis page)
 ~ 8 modified (sidebar, App.tsx, OpenAPI, codegen output)
```

---

## How to deploy this on the VPS

```bash
# 1. Pull
cd /var/www/marketing-plan-expert
git pull origin main

# 2. Install new deps (new packages: vitest, supertest, integrations-openai, integrations-xai)
pnpm install --frozen-lockfile

# 3. Apply DB migration (additive — safe on populated DB)
psql "$DATABASE_URL" -f lib/db/migrations/0000_ads_strategy_bootstrap.sql

# 4. Build + restart
pnpm build
pm2 restart marketing-api --update-env

# 5. Verify
curl -s https://your-domain/api/healthz                       # 200
curl -s -b cookies.txt https://your-domain/api/ads-strategy/reports  # [] (empty)
```

---

## What's NOT in this Phase (per UPGRADE_PLAN)

- 🚫 Real AI calls — module endpoints return 501. **Phase 2** wires Claude Haiku (M1) + Gemini Flash (M2)
- 🚫 Frontend forms with results — placeholder page only. **Phase 2** lands `AudienceTab.tsx` + `KeywordsTab.tsx`
- 🚫 CSV upload + Sonnet analysis — **Phase 3** ships M3
- 🚫 Grok trend pulse — **Phase 4** ships M4
- 🚫 Brand context seed data for 11 brands — decision 8C: scaffold trống, fill via UI in Phase 4
- 🚫 Refactoring inline OpenAI/Grok in `routes/{messenger,pipeline}.ts` to use new integration packages — defer to Phase 2 cleanup

---

## Decisions deferred / open

These came up during Phase 1 but didn't block:

1. **Test coverage threshold** — currently 4 tests. Phase 2 should add tests for `reports.handler.ts` CRUD against a real test Postgres (testcontainers or pg-mem).
2. **Pre-existing TS7030 / TS18047 errors** in 10+ existing route/page files. Audit recommended out-of-scope cleanup; can spawn separate task.
3. **`pre-existing TS6305 / unrelated batch utils errors`** in `lib/integrations-{anthropic,gemini}-ai/src/batch/utils.ts` — `p-retry` API change. Should be fixed during Phase 2 when these get touched.

---

## Next: Phase 2

Per `docs/UPGRADE_PLAN.md` mục 2, ~12h work:
- Prompt builders for M1 + M2
- Wire Claude Haiku for M1 audience targeting
- Wire Gemini Flash for M2 keyword groups
- Frontend `AdsStrategyPage.tsx` with 4 tabs (M3+M4 disabled)
- `AudienceTab.tsx`, `KeywordsTab.tsx` with form + results
- Token cost dashboard (UI for the `cost-summary` endpoint we already built)

Ready to start when user confirms Phase 1 is good.
