# Phase 5a — Weekly Trend Digest (cron + Telegram/Make.com) — Summary

**Date:** 2026-05-04
**Phase:** 5a (post-launch automation)
**Status:** ✅ Backend + frontend functional. Disabled by default — user opts in.

---

## What shipped

A cron-driven weekly digest that automatically scans M4 trends for every
brand with a primary region set, formats the top 3 trends per brand into
a Markdown message, and dispatches via Telegram bot or Make.com webhook.

Designed so Phuong Oanh wakes up Sunday morning to "📈 Weekly Trend Digest"
in her Telegram with concrete content angles per Paradise Nails / Happy
Wok / etc., instead of having to remember to open the app.

### Backend

**DB schema (commit `307b0d8`):**
- `scheduled_jobs` — catalog row per cron job. Columns: `job_key` (unique),
  `name`, `cron_expression`, `enabled` (default false), `config` JSONB,
  `last_run_at`, `next_run_at`. Pre-seeded with one row:
  `weekly_trend_digest, "0 8 * * 0"` (Sunday 08:00 Berlin), DISABLED
- `scheduled_runs` — audit log per firing. Status enum
  (running/success/partial/failed) + trigger enum (cron/manual) enforced
  via CHECK constraints. summary JSONB + payload TEXT (formatted msg) +
  total_cost_eur + brand counts + duration. Indexed on (job_key, started_at DESC)
- Migration `0001_scheduled_jobs.sql`, additive + idempotent

**Dispatcher (`artifacts/api-server/src/jobs/dispatcher.ts`):**
Resolution order with sensible fallback:
1. `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` → POST to api.telegram.org
   (Markdown parse_mode, truncates >4000 chars)
2. `MAKE_WEBHOOK_URL` → POST `{ event_type, text, data }` so Make scenarios
   can route however the user wants
3. None set → log warning + persist payload only (so the user can still
   read it from the UI)

Always returns a structured `DispatchResult` so the audit row records what
actually happened.

**Job runner (`jobs/scheduled/weekly-trend-digest.ts`):**
- `selectBrandsForDigest()` — pure function, picks brands with
  `ads_context.primaryRegions` (or honors `config.brandIds` allowlist)
- `formatDigestMessage()` — pure function, renders Markdown with rising
  📈 / peak 🔥 / declining 📉 icons + total cost + failure section
- `runWeeklyTrendDigest()` orchestrates: insert running row → loop brands
  → call existing `getTrendPulse` (cache hits = €0) → format → dispatch
  → finish row with status + cost + brand counts. Per-brand failures
  don't abort the whole run — partial digest still ships.

**Scheduler (`jobs/scheduler.ts`):**
- `startScheduler()` registers node-cron tasks for every job in the
  catalog at api-server boot. Re-checks `enabled` on every tick so
  toggling from UI takes effect on next tick without server restart.
- TIMEZONE = `Europe/Berlin`
- Skips when `NODE_ENV=test` or `SCHEDULER_DISABLED=1`
- Catches table-missing errors gracefully (unmigrated DB doesn't crash
  the api-server)

**API endpoints (added to `routes/automation.ts`):**
- `GET    /api/automation/scheduled-jobs` — list catalog
- `PATCH  /api/automation/scheduled-jobs/:jobKey` — toggle enabled / change
  cron / update config
- `POST   /api/automation/scheduled-jobs/:jobKey/trigger` — manual run
  (returns immediately, status appears in scheduled-runs)
- `GET    /api/automation/scheduled-runs[?jobKey&limit]` — audit log

**Boot wiring (`index.ts`):**
- `startScheduler()` called AFTER `app.listen()` so health checks succeed
  even if scheduler later fails

### Frontend

**`pages/automation/TrendDigestPanel.tsx`** — new 4th tab "Weekly Trend Digest" on `/automation` page:
- Hero card showing job name, cron expression, status badge (ON/OFF), last-run timestamp
- Two big buttons: "Bật/Tắt" (toggle enabled) + "Chạy thử" (manual trigger)
- Note explaining delivery target priority (Telegram → Make → log only)
- Recent-runs list (last 10), each row collapsible to show full Telegram
  message preview + raw summary JSON
- Status badges with running spinner / success ✓ / partial ⚠ / failed ✗
- Auto-refresh runs list every 3s while a 'running' row is on top

### Tests

7 new tests in `jobs/scheduled/weekly-trend-digest.test.ts`:
- `selectBrandsForDigest` with/without allowlist, empty allowlist
- `formatDigestMessage` — header, per-brand sections, momentum icons,
  failure section, all-failed fallback, total cost calculation

**Total: 70/70 tests pass** (up from 63 in Phase 4).

---

## Live verification

Against demo Postgres + fake AI keys:

```
Boot log:
[scheduler] Registered weekly_trend_digest on "0 8 * * 0" (Europe/Berlin) — currently disabled  ✓

GET /api/automation/scheduled-jobs
→ 200 [{jobKey: weekly_trend_digest, enabled: false, ...}]  ✓

PATCH ... {enabled: true}
→ 200 {enabled: true}  ✓

POST .../trigger
→ 200 {ok: true} (returns immediately)  ✓

After ~6s:
GET /api/automation/scheduled-runs?limit=1
→ status=failed trigger=manual processed=0 failed=5 cost=€0.0000 duration=833ms  ✓
   (5 brands have primaryRegions; all failed with Grok 401 from fake key —
    proves the runner iterated correctly and persisted the audit row)

Payload preview generated correctly:
"📈 *Weekly Trend Digest*
 _5.5.2026, 13:09:16 (Europe/Berlin)_
 Brands processed: *0* (failed: 5)
 ⚠ *Failures:*
 • Paradise Nails Memmingen — Grok HTTP 401 ..."   ✓
```

---

## How to deploy on the VPS

```bash
cd /var/www/marketing-plan-expert
git pull origin main
pnpm install --frozen-lockfile
psql "$DATABASE_URL" -f lib/db/migrations/0001_scheduled_jobs.sql
pnpm build
pm2 restart marketing-api --update-env
```

The scheduler auto-starts on boot. The job is **disabled by default**;
toggle it on in `/automation → Weekly Trend Digest` tab.

### Required env vars for delivery

Pick ONE:

```bash
# Option A — direct Telegram (simplest, no Make.com account needed)
TELEGRAM_BOT_TOKEN=123456:ABC...   # from @BotFather
TELEGRAM_CHAT_ID=-1001234567890    # group chat, or your user ID

# Option B — via Make.com (already configured for content automation)
MAKE_WEBHOOK_URL=https://hook.eu2.make.com/...   # already in your env
```

If neither is set, the digest runs and persists the payload (you can read
it from the UI), but it doesn't get delivered anywhere.

---

## Cost model

- Each weekly run iterates brands with `primaryRegions` (currently 5 of 11)
- Per brand: 1 Grok 3 call ≈ €0.025 (cache HIT = free if same region/topic
  within 7 days, which always holds for the weekly cron because the cron
  fires exactly weekly)
- **Realistic**: first run €0.125, subsequent runs €0.00 (cache hit) →
  **~€0.125 / 4 weeks = €0.03 / month**
- Even forcing `bypassCache: true` every week: €0.50/month

Far cheaper than M3 Performance (€0.06/run × 1-2 manual runs/week ≈ €0.50/month)
and pure pull/passive value.

---

## What's NOT in this phase

- 🚫 **Cron weekly M3 with Meta Ads API** — needs Meta App Review (1-3 days
  blocking) and OAuth flow. Phase 5b if you decide to go for it.
- 🚫 **Cross-module workflow** (M4 trend → auto-trigger M1 audience for
  that trend) — straightforward but cosmetic vs current passive value.
- 🚫 **A/B prompt versioning UI** — `prompt_version` is already persisted
  in `ads_reports.input.meta`, just no comparison view yet.
- 🚫 **Multi-tenant SaaS** — separate phase. Adds user/org tables, scoped
  queries, invitations, billing. 20-30h work.

---

## Next steps for Phuong Oanh

1. Deploy this phase to the VPS (steps above)
2. Pick delivery method: easiest is creating a Telegram bot via @BotFather,
   adding it to your group, set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
3. Open `/automation → Weekly Trend Digest` tab
4. Click **Chạy thử** to test once with 1 brand → verify message arrives
5. Click **Bật** to enable cron — now Sunday 8 AM Berlin you'll get the
   digest automatically
6. Tweak `ads_context.primaryRegions` per brand to control which brands
   are included (Phase 4 editor at `/brands/:id/ads-context`)

The Ads Strategy Agent + Brand Context Editor + Weekly Trend Digest are
together a complete "always-on" marketing intelligence loop.
