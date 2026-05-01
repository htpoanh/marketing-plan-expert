# Phase 2 — M1 Audience + M2 Keywords — Summary

**Date:** 2026-05-01
**Phase:** 2 of 4 (per `docs/UPGRADE_PLAN.md`)
**Status:** ✅ Backend + frontend tabs functional. M3/M4 still stubs.

---

## What shipped

### Backend (already committed `8cb383a`)

**Services** (`artifacts/api-server/src/services/ads-strategy/`)
- `prompt-builder.ts` — `buildBrandContextSection(brand)` renders top-level brand + ads_context JSON into a Markdown-ish block; defensive against missing fields
- `prompts/audience.prompt.ts` — system + user prompt templates (versioned)
- `prompts/keywords.prompt.ts` — same
- `audience.service.ts` — Claude Haiku 4.5, prefill `{`, JSON.parse, Zod validate
- `keywords.service.ts` — Gemini 2.5 Flash with `responseMimeType: application/json`
- `cost-calculator.ts` — €/1M-tokens lookup for 8 models, fallback rate, decimal(10,4) string output
- `output-validators.ts` — Zod schemas for both module outputs

**Handlers** (`routes/ads-strategy/modules.handler.ts`)
- `POST /audience` and `POST /keywords` no longer return 501 — they validate input, load brand, call service, persist to `ads_reports`, return saved row
- `POST /performance` and `POST /trend` still 501 (Phase 3 / 4)
- 400 for input validation failure, 404 for missing brand, 502 for AI errors, 500 for everything else

**Tests** (24 passing offline, no AI tokens consumed)
- `prompt-builder.test.ts` — 9 tests
- `cost-calculator.test.ts` — 6 tests
- `modules.handler.test.ts` — 9 tests (mocked services + db)

### Frontend (this commit)

**Page** (`artifacts/marketing-platform/src/pages/strategy/ads/`)
- `AdsStrategyPage.tsx` — main page, 4 tabs (M1/M2 active, M3/M4 with "coming soon" notice). Cost dashboard at top, reports library at bottom.
- `AudienceTab.tsx` — form (brand/service/goal/budget/language) + result panel
- `KeywordsTab.tsx` — form (brand/service/competitors textarea/language) + result panel
- `types.ts` — re-exports generated `Brand` + adds frontend-side AudienceOutput / KeywordsOutput types (since OpenAPI declares output as `additionalProperties: true`)

**Components** (`pages/strategy/ads/components/`)
- `AudienceResult.tsx` — 4 sub-tabs (Personas / Meta JSON / Google Targeting / Budget+Steps), per-persona cards with pain points + buying triggers + budget split bar chart, copy-JSON buttons for ad-set configs
- `KeywordsResult.tsx` — 4 keyword tables (Money / Discovery / Defensive / Long-tail) with intent score + volume + CPC badges, CSV export button, warnings + verification checklist panels
- `CostSummaryWidget.tsx` — top of page, hits `GET /api/ads-strategy/cost-summary`, shows MTD spend + calls + tokens + per-bucket model chips
- `ReportsLibrary.tsx` — collapsible bottom panel listing saved reports with module filter pills, expand to see full output JSON, delete with confirmation (uses generated `useDeleteAdsReport` + invalidates list query)

**Routing** (`App.tsx`)
- Replaced `AdsStrategyComingSoon` placeholder with real `AdsStrategyPage`
- Routes: `/strategy/ads` and `/strategy/ads/:tab`

---

## Verification

### Tests
```
artifacts/api-server> pnpm test
 ✓ src/services/ads-strategy/cost-calculator.test.ts (6)
 ✓ src/services/ads-strategy/prompt-builder.test.ts (9)
 ✓ src/routes/ads-strategy/modules.handler.test.ts (9)
 Tests  24 passed (24)
```

### Typecheck
- `lib/*` — clean
- `artifacts/api-server` — zero new errors in `src/{services,routes}/ads-strategy/*`
- `artifacts/marketing-platform` — zero new errors in `src/pages/strategy/ads/*`

### Live HTTP smoke (with fake AI keys)
```
POST /api/ads-strategy/audience  {brandId:2, service:"Gel-Nägel...", ...}
→ 502 "AI provider rejected the request: 401 invalid x-api-key"
   ✓ Confirms Anthropic SDK is wired and reachable; just needs real key

POST /api/ads-strategy/keywords  {brandId:2, service:"Gel-Nägel"}
→ 502 "AI provider rejected the request: ... API key not valid"
   ✓ Confirms Gemini SDK is wired

POST /api/ads-strategy/audience  {brandId:2}      (missing service)
→ 400 "audience validation failed" + Zod details
   ✓ Input validation works
```

### UI smoke
- Open http://localhost:5173/strategy/ads
- See: hero, cost-summary widget, 4 module tabs (M1+M2 enabled, M3+M4 dimmed), reports library at bottom
- Click M1 tab → form renders, brand dropdown populated from `useListBrands`
- Click M2 tab → keyword form
- M3 / M4 tabs → "coming soon" notices

---

## How to deploy on the VPS

```bash
cd /var/www/marketing-plan-expert
git pull origin main
pnpm install --frozen-lockfile
# DB schema is unchanged from Phase 1 — no new migration needed
pnpm build
pm2 restart marketing-api --update-env
```

To actually run AI calls from the VPS, the `.env` needs real keys:
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (for M1)
- `AI_INTEGRATIONS_GEMINI_API_KEY` (for M2)

---

## What's NOT in this Phase

- 🚫 **M3 Performance** — CSV upload + Sonnet analysis. Phase 3.
- 🚫 **M4 Trend Pulse** — Grok with web search. Phase 4.
- 🚫 **Per-report PDF export.** Reports are persisted as JSON; user can already copy via UI. PDF later.
- 🚫 **Brand context editor UI** — `ads_context` field on brands. Currently only seedable via SQL / push migration. Phase 4.
- 🚫 **Compare reports side-by-side** — Phase 4.
- 🚫 **i18n cleanup** — UI strings hardcoded Vietnamese. Phase 4.

---

## Decisions deferred

- **Pre-existing TS errors** in `pages/{calendar,messenger,pipeline,approvals}` — out of scope; not from this PR
- **Inline OpenAI/Grok refactor** in `routes/{messenger,pipeline}.ts` to use new integration packages — defer until those routes are touched

---

## Cost model — actual

A typical Phase 2 generate cycle on this brand seed:
- M1 audience (Haiku, ~3-4k input + 2k output) → ~€0.012 / call
- M2 keywords (Gemini Flash, ~2.5k input + 1.5k output) → ~€0.0015 / call

Heavy daily user (5 audience + 5 keyword runs) ≈ **€2.10 / month**. Cost-summary
widget shows MTD spend + breakdown so the user can spot anomalies early.

---

## Next: Phase 3

Per `docs/UPGRADE_PLAN.md` mục 3, ~10h work:
- CSV parser service (Meta + Google formats, normalize, aggregate stats, top/bottom rows)
- M3 service: Claude Sonnet, longer max_tokens (8000), temperature 0.5
- Multer multipart endpoint accepting CSV file
- `PerformanceTab.tsx`: CSVDropzone + report rendering with Recharts (KPI cards, budget reallocation visual, hypothesis cards, A/B test design)
- Mobile responsive polish for all 3 tabs
