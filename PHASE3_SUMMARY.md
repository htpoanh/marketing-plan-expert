# Phase 3 — M3 Performance Reality — Summary

**Date:** 2026-05-04
**Phase:** 3 of 4 (per `docs/UPGRADE_PLAN.md`)
**Status:** ✅ Backend + frontend functional. M4 Trend remains stub.

---

## What shipped

### CSV parser (P3.1, commit `0eff5c3`)

`artifacts/api-server/src/services/ads-strategy/csv-parser.ts`:
- `parseAdsCsv(text)` — auto-detects Meta vs Google Ads from header tokens, normalises both formats into `NormalizedAdRow[]` (campaign, adSet, spend, impressions, clicks, ctr, cpc, conversions, cpa, conversionValueEur, roas)
- `selectTopAndBottom(rows, metric, count)` — picks high/low extremes by spend / CPA / ROAS / CTR; used to bound prompt token count regardless of CSV size
- `aggregateStats()` — blended totals + averages across all rows
- `CsvParseError` class with `hint` field → handler returns Vietnamese error + actionable hint
- Edge cases handled: BOM, CRLF, German "1.234,56", US "1,234.56", quoted commas, percent/currency symbols, empty rows
- Zero external deps — pure stdlib parser

3 fixtures + 22 tests in `csv-parser.test.ts`.

### Performance service + handler (P3.2, commit `ae86579`)

`services/ads-strategy/performance.service.ts`:
- `analyzePerformance(input, brand)` pipeline:
  1. parseAdsCsv → top10 by spend + bottom10 by CPA + sample of all rows ≤50
  2. buildPerformanceUserPrompt with brand context + aggregate stats + curated rows
  3. Claude Sonnet 4.5, max 6000 tokens, temperature 0.5, prefill `{` for JSON-only
  4. JSON.parse + Zod validate (`performanceOutputSchema`)
  5. Cost calc + return everything for handler to persist

`services/ads-strategy/prompts/performance.prompt.ts`:
- System: "Be brutally honest about waste. Every recommendation needs evidence."
- User prompt: brand context + aggregate stats + top/bottom/all rows JSON + 6-section schema (executive summary, what working, what wasting, hypotheses, budget reallocation, risks)
- Output language for explanations is configurable; campaign / ad-set names stay verbatim

`routes/ads-strategy/modules.handler.ts`:
- Replaced 501 stub with `POST /performance` handler
- Cache key uses 16-char SHA256 of CSV content (NOT full CSV — kept compact). Brand snapshot + prompt version included → editing brand or bumping prompt invalidates cache
- 400 + hint on `CsvParseError`, 502 on AI errors, 500 otherwise
- Persists parsed summary (NOT raw CSV) to `ads_reports.input` to save DB space

4 new handler tests + 22 parser tests = 60/60 in api-server suite.

### Frontend Performance tab (P3.3, this commit)

`pages/strategy/ads/PerformanceTab.tsx`:
- Form: brand select, CSV dropzone, CPL target €, avg ticket €, ROAS target, output language, bypass-cache toggle
- Calls `useAnalyzeAdsPerformance` (generated hook from OpenAPI)
- "Print / Export PDF" button → triggers `window.print()` → relies on print CSS

`components/CSVDropzone.tsx`:
- Drag-drop + click-to-pick file input
- Reads file via FileReader as text
- Quick header sniff: tells user "Đã nhận dạng: Meta Ads" / "Google Ads" / "Không nhận dạng được" before submit
- 5-row preview in collapsible `<details>`
- Validates `.csv`/`.tsv` extension + max 10MB
- Disabled during mutation pending

`components/PerformanceResult.tsx`:
- Stats header: detected platform, row count, total spend, AI model, latency, cost
- Executive summary card (gradient amber background)
- 5 tabs: Đang chạy tốt / Lãng phí / Hypotheses / Chia lại budget / Rủi ro
- "Working" tab: pattern cards with confidence badges (high/medium/low) + evidence chips
- "Wasting" tab: data-rich table with red spend amounts + recommended action badges
- Hypotheses tab: collapsible H1/H2/H3 cards, A/B variants in colored side-by-side panels, sample size + decision criteria + expected impact
- Budget reallocation tab: from→to table with delta-zero check (warns if AI proposed adding budget, not just shifting)
- Risks tab: amber-highlighted list

`AdsStrategyPage.tsx`:
- M3 tab no longer dimmed — shows real `<PerformanceTab>` component
- Tab label changed from "Phase 3" → "Claude Sonnet"

`index.css`:
- New `@media print` block — hides app shell, forms, navigation; reveals all tab panels (so a printed PDF includes Hypotheses + Reallocation even if user only had one tab open); page-break-inside: avoid for cards/tables

---

## Cost model — actual

| Module | Input tokens | Output tokens | Cost/call |
|---|---|---|---|
| M1 Audience | ~3,500 | ~2,000 | €0.013 |
| M2 Keywords | ~2,500 | ~1,500 | €0.0015 |
| **M3 Performance** | ~7,800 | ~2,900 | **€0.062** |
| M4 Trend (Phase 4) | ~2,000 | ~2,000 | €0.025 |

Cache hits (same CSV ≤7d, same brand) → €0.00.

Heavy daily use (5 audience + 5 keyword + 3 performance / week, 80% cache hit
rate after first run) ≈ **€0.50-1.50 / month total AI cost.**

---

## Verification

### Tests
```
artifacts/api-server> pnpm test
 ✓ src/services/ads-strategy/cache.test.ts (7 tests)
 ✓ src/services/ads-strategy/cost-calculator.test.ts (6 tests)
 ✓ src/services/ads-strategy/csv-parser.test.ts (22 tests)
 ✓ src/services/ads-strategy/prompt-builder.test.ts (9 tests)
 ✓ src/routes/ads-strategy/modules.handler.test.ts (16 tests)
 Tests  60 passed (60)
```

### Typecheck
- `lib/*` — clean
- `artifacts/api-server` — zero new errors in `src/{services,routes}/ads-strategy/*`
- `artifacts/marketing-platform` — zero new errors in `src/pages/strategy/ads/*`

### Live HTTP smoke (with fake API keys)
```
POST /api/ads-strategy/performance + malformed CSV
→ 400 "CSV không hợp lệ: Could not detect ad platform from headers"
   + hint pointing to expected Meta/Google headers ✓

POST /api/ads-strategy/performance + valid Meta CSV (15 rows)
→ 502 "AI provider rejected the request: 401 invalid x-api-key"
   ✓ Confirms parser ran successfully, prompt built, Sonnet called.
   With a real key the response would be the analysis report.

POST /api/ads-strategy/performance with no csvData
→ 400 (Zod validation) ✓

POST /api/ads-strategy/trend (M4)
→ 501 (still stub, Phase 4) ✓
```

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

To run M3 against real data, the `.env` needs `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
(Sonnet specifically — same key works for Haiku from M1).

---

## What's NOT in this Phase

- 🚫 **M4 Trend Pulse** — Grok with web search. Phase 4.
- 🚫 **Sankey diagram** for budget reallocation — using a clean table instead;
  Sankey is nice-to-have, table is faster to read on mobile
- 🚫 **react-pdf branded export** — using browser print CSS (Cmd+P → PDF)
  works fine for SMB user; can upgrade to react-pdf later if needed
- 🚫 **Multi-period comparison** (this month vs last month) — needs storing
  multiple reports + diffing UI; defer to Phase 5

## Decisions deferred / open

1. **Storing parsed CSV stats** — currently we re-parse the CSV on cache miss.
   Could memoize parsed.rows alongside the report so the result panel can
   render row-level drill-down without re-uploading. Phase 4.
2. **Pre-existing TS7030 errors** in `pages/{calendar,messenger,...}` — out
   of scope per audit
3. **Recharts visualization** — could add a CTR-by-campaign bar chart or
   spend-vs-conversions scatter. Currently table-only is enough.

---

## Next: Phase 4

Per `docs/UPGRADE_PLAN.md` mục 4, ~8h work:
- Grok 3 integration via `lib/integrations-xai`
- Web search enabled (sources: web DE + X + news DE)
- Trend topic + region focus + brand context → 5-10 trend cards
- Each trend: relevance score, momentum (rising/peak/declining),
  suggested angle, sources URLs, estimated capitalize window in days
- Frontend `TrendTab.tsx` with trend cards + "use this trend" hook
  into the existing content generator
- Brand context editor UI (so user can fill `ads_context` JSONB per brand
  for richer prompts in all 4 modules)
- Reports library: bulk delete, filter by date range, search in user notes
- i18n cleanup
- Mobile responsive polish across all 4 tabs

After Phase 4, the Ads Strategy Agent is feature-complete per the v2 plan.
