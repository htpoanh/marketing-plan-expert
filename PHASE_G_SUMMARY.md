# Phase G — Auto-Reply Engine — Summary

**Date:** 2026-06-03
**Phase:** G (per v3.0 master prompt — Unified AI Marketing Manager)
**Status:** ✅ Backend + frontend functional. Disabled by default — user opts in per brand.

---

## What shipped

A unified Auto-Reply Engine across **Google reviews + Facebook/Instagram comments**,
built on top of the existing GBP OAuth, the Messenger webhook, and the Phase 5a
cron/dispatcher infrastructure (no rework of those).

**Decisions taken:** keep Grok for trends (no AI-stack change); FB/IG comments are
routed by intent — **public reply for compliments, private DM for booking/price**,
complaints always escalate.

### Database (migration `0002_auto_reply.sql` — additive, generate-only)

- `reply_queue` — one row per inbound interaction (platform, externalId, author,
  rating, originalMessage, suggestedReply, replyMode, intent, sentiment, status,
  statusReason, sentReply, sentAt) + indexes + platform/status CHECK constraints.
- `auto_reply_settings` — per-brand toggles + guards (`googleEnabled`,
  `fbCommentsEnabled`, `igCommentsEnabled`, `dailyCap`=50, `escalateThreshold`=2).
  Missing row ⇒ everything off.
- Seeds `scheduled_jobs` row `review_auto_reply` (cron `0 * * * *`), **disabled**.

Drizzle schema: `lib/db/src/schema/{reply_queue,auto_reply_settings}.ts` + exported in `index.ts`.

### Services (`artifacts/api-server/src/services/auto-reply/`)

- `intent-classifier.ts` — German keyword pass (booking/price/complaint/compliment/other)
  + Claude Haiku fallback only for ambiguous "other". Complaint wins ties (safety).
- `reply-rules.ts` — review rules (5★ auto · 3-4★ auto+invite · ≤threshold escalate)
  + comment rules (compliment→public, booking/price→private DM, complaint→escalate).
- `guards.ts` — blocks refund/discount/voucher promises, daily-cap check, negative-sentiment block.
- `brand-voice.ts` — 6 German sign-offs matched by brand name substring.
- `reply-generator.ts` — Claude Sonnet German drafting with brand voice + sign-off.
- `meta-comments.ts` — Graph API helpers: public reply, private reply (DM via comment_id), IG variants.
- `gmb-reply.ts` — pushes a review reply to Google (reuses the v4 path + token refresh).
- `comment-handler.ts` — end-to-end pipeline for one FB/IG comment (idempotent, self-contained errors).

### Jobs

- `jobs/scheduled/review-auto-reply.ts` — hourly: sync GMB → rules → guards → push ≥3★
  replies, escalate ≤2★ to queue + Telegram alert (via existing dispatcher). Audit row in
  `scheduled_runs`. Registered in `scheduler.ts` `JOB_RUNNERS`.

### Webhook

- `routes/messenger.ts` — extended `POST /messenger/webhook` to handle `entry.changes`
  (FB feed comments + IG comments under object "instagram"), delegating to `comment-handler`.
  Skips the page's own comments; idempotent on comment id.

### API (OpenAPI-first → Orval)

New `/api/auto-reply` router (`routes/auto-reply/index.ts`), mounted in `routes/index.ts`:

- `GET  /auto-reply/queue?brandId&platform&status&limit`
- `PATCH /auto-reply/queue/:id` (edit draft / skip)
- `POST /auto-reply/queue/:id/send` (pushes to Google or Meta, marks manual_sent)
- `GET  /auto-reply/stats?brandId` (auto-replied today, pending, escalated, avg response mins)
- `GET/PATCH /auto-reply/settings/:brandId` (per-brand toggles + guards, upsert)

Spec added to `lib/api-spec/openapi.yaml` (tag `autoReply`, 5 paths, 9 schemas).

### Frontend (`artifacts/marketing-platform/src/pages/inbox/`)

- `InboxPage.tsx` — `/inbox` page: stats header (4 cards), brand filter, 4 platform tabs
  (Google/FB/IG/Messenger), status filter, settings drawer.
- `components/QueueItemCard.tsx` — editable suggested reply, Send/Skip, intent/status/rating/mode badges.
- `components/AutoReplySettingsPanel.tsx` — per-brand toggles + dailyCap + escalateThreshold + cron note.
- Route `/inbox` in `App.tsx`; sidebar item "Hộp thư Auto-Reply".

---

## Verification

**Pure-logic suites — run & PASSED in-sandbox** (Node `--experimental-strip-types`,
38 assertions mirroring the 4 vitest files):
- `reply-rules` + `guards` + `brand-voice` → 26/26
- `intent-classifier` (keyword pass) → 12/12

Vitest test files written for all four: `*.test.ts` next to each service.

**Not run in-sandbox** (require installed deps — run on dev/VPS):
- `pnpm --filter @workspace/api-spec codegen` — regenerate React Query hooks + Zod. **Required before the frontend builds**
  (InboxPage imports `useListReplyQueue`, `useGetAutoReplyStats`, `useGetAutoReplySettings`,
  `useUpdateAutoReplySettings`, `useSendReplyQueueItem`, `useUpdateReplyQueueItem` + types).
- `pnpm typecheck` per workspace.
- `pnpm --filter @workspace/api-server test` — runs the new `*.test.ts` + existing 70.

---

## How to deploy on the VPS

```bash
cd /var/www/marketing-plan-expert
git pull origin main
pnpm install --frozen-lockfile
psql "$DATABASE_URL" -f lib/db/migrations/0002_auto_reply.sql   # additive, safe
pnpm --filter @workspace/api-spec codegen                          # regenerate hooks
pnpm build
pm2 restart marketing-api --update-env
```

Then in the app: open `/inbox` → pick a brand → ⚙ → enable the channels you want.
For hourly Google auto-reply, also enable the `review_auto_reply` job in
`/automation → Scheduled Jobs`. Telegram escalations reuse `TELEGRAM_BOT_TOKEN` +
`TELEGRAM_CHAT_ID` (or `MAKE_WEBHOOK_URL`).

### Meta app config (one-time)
Subscribe the page webhook to the **feed** field (FB comments) and **comments**
(IG). The existing verify-token flow is unchanged.

---

## What's NOT in this phase / known limitations

- 🚫 **IG brand mapping** — `messenger_configs` stores no IG account id, so IG comment
  events fall back to the first active config. If you run multiple IG accounts, add an
  `ig_account_id` column to disambiguate.
- 🚫 **Messenger tab** in /inbox is a link to the existing `/messenger` page (DMs are
  already auto-handled by the booking bot) rather than a queue view.
- 🚫 **`any` in the webhook payload parsing** — consistent with the existing
  `messenger.ts` style (raw untyped Meta JSON).
- 🚫 Bulk actions / date-range filter / per-brand cost rollup for the inbox — deferrable.

---

## Files changed

New (15): 2 schema + 1 migration + 8 services + 1 job + 1 route + 2 frontend components + 1 page,
plus 4 `*.test.ts`. Modified (6): `schema/index.ts`, `reviews.ts` (export syncGmbForBrand),
`scheduler.ts`, `messenger.ts`, `routes/index.ts`, `openapi.yaml`, `App.tsx`, `Sidebar.tsx`.
