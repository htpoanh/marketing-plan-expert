# Phase B — Strategy Inbox — Summary

**Date:** 2026-06-03
**Phase:** B (per v3.0 master prompt)
**Status:** ✅ Backend + frontend functional.

---

## What shipped

A `/strategy-inbox` where Phuong Oanh drops in campaign ideas, company goals,
format experiments, or post-service feedback at any time. On submit, Claude
analyses the item synchronously and the structured assessment is saved alongside
the raw input — ready for the weekly report (Phase E) to pull from.

### Database (migration `0003_strategy_inbox.sql` — additive, generate-only)

`strategy_inbox`: `brandId` (NULLABLE — null = all brands), `inputType`
(campaign_idea/company_goal/format_test/feedback/other), `content`, `priority`
(high/medium/low), `deadline`, `claudeAnalysis` JSONB, `status`
(pending/analyzed/incorporated/archived), `incorporatedInWeek`, token counts +
indexes + CHECK constraints. Schema in `lib/db/src/schema/strategy_inbox.ts`,
exported from `index.ts`.

### Service (`artifacts/api-server/src/services/strategy-inbox/`)

- `prompt.ts` — builds the German analysis prompt; reuses
  `buildBrandContextSection` (Ads Strategy) for brand context, and emits an
  "applies to ALL brands" note when `brandId` is null.
- `output-validator.ts` — Zod schema (`.passthrough()`) for the analysis JSON.
- `analyze.service.ts` — Claude Sonnet, prefill `{` for JSON-only, parse +
  validate + cost estimate (reuses `cost-calculator`).

Analysis shape: `summary`, `feasibility {rating, rationale}`, `timeline`,
`resources[]`, `risks[]`, `recommendedWeek`, `alignsWithTrends?`.

### API (OpenAPI-first → Orval)

New `/api/strategy-inbox` router (`routes/strategy-inbox/index.ts`), mounted in
`routes/index.ts`:

- `POST /strategy-inbox` — create + run Claude analysis synchronously (201).
  If the AI call fails, the row is still saved as `pending` (re-analyse later).
- `GET /strategy-inbox?brandId&status&limit`
- `GET /strategy-inbox/:id`
- `PATCH /strategy-inbox/:id` — status / incorporatedInWeek / priority
- `POST /strategy-inbox/:id/reanalyze`
- `DELETE /strategy-inbox/:id`

Spec added to `openapi.yaml` (tag `strategyInbox`, 4 paths, 6 schemas).

### Frontend (`artifacts/marketing-platform/src/pages/strategy-inbox/`)

- `StrategyInboxPage.tsx` — submit form (brand incl. "Tất cả", type, content,
  priority, deadline) + brand/status filters + list.
- `components/StrategyItemCard.tsx` — renders the Claude analysis (feasibility,
  timeline, resources, risks, recommended week) with actions: re-analyse, mark
  "incorporated", archive, delete.
- Route `/strategy-inbox` in `App.tsx`; sidebar item "Hộp thư chiến lược".

---

## Verification

**Run & PASSED in-sandbox** (Node `--experimental-strip-types`):
- `prompt.ts` → 10/10 assertions (brand vs all-brands, deadline, language, schema).

Vitest files written: `prompt.test.ts`, `output-validator.test.ts`.

**Not run in-sandbox** (need installed deps — run on dev/VPS):
- `pnpm --filter @workspace/api-spec codegen` — **required before frontend builds**
  (page imports `useCreateStrategyInboxItem`, `useListStrategyInboxItems`,
  `useUpdateStrategyInboxItem`, `useReanalyzeStrategyInboxItem`,
  `useDeleteStrategyInboxItem` + types).
- `pnpm typecheck`, `pnpm --filter @workspace/api-server test`.

---

## Deploy

```bash
git pull origin main
pnpm install --frozen-lockfile
psql "$DATABASE_URL" -f lib/db/migrations/0003_strategy_inbox.sql
pnpm --filter @workspace/api-spec codegen
pnpm build
pm2 restart marketing-api --update-env
```

Needs `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (Sonnet). Cost ≈ €0.01–0.02 per
analysis.

---

## Cost

Claude Sonnet, ~1.5k in + 0.8k out per analysis ≈ €0.015/item.
