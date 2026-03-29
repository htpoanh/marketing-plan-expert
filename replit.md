# AI Marketing Strategist Platform

## Overview

A Vietnamese AI-powered marketing platform for managing multiple store locations. Features Google review management with AI auto-reply, content generation, marketing strategy, and a content calendar with Metricool integration.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/marketing-platform)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **AI Engine**: Multi-model pipeline — Grok (trend), GPT-4o (strategy+prompts), Gemini (content), Claude Sonnet (refinement+reviews)
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── marketing-platform/ # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas
│   ├── db/                 # Drizzle ORM schema + DB connection
│   │   └── src/schema/
│   │       ├── brands.ts       # Store/brand management
│   │       ├── reviews.ts      # Google reviews
│   │       ├── content_plans.ts # Content calendar
│   │       ├── conversations.ts # Gemini AI conversations
│   │       └── messages.ts     # Gemini AI messages
│   ├── integrations-gemini-ai/     # Gemini AI integration
│   └── integrations-anthropic-ai/  # Claude AI integration (Replit AI Integrations)
```

## Features

### 1. Quản lý cửa hàng (Brand Manager)
- CRUD for multiple store/brand profiles
- Fields: name, industry, location, target audience, brand voice, social links, Google Place ID

### 2. Đánh giá Google (Google Reviews)
- Manual review entry (until Google API integration)
- Filter by store, rating, replied/unreplied
- AI auto-reply generation (Claude Sonnet) for any star rating — professional German customer service responses
- Auto-reply tone: 1-2 stars (apologetic), 3 stars (constructive), 4-5 stars (grateful)

### 3. Báo cáo đánh giá (Review Reports)
- Per-store stats: total, average rating, replied/unreplied
- Star rating breakdown (1-5) with charts

### 4. Tạo nội dung AI (Content Generator)
- Input: brand, platform (FB/IG/TikTok), content type, topic, campaign goal
- Output: 3 viral hooks, main caption, short caption, CTA, hashtags, image prompt, video prompt

### 5. Chiến lược AI (Strategy Generator)
- Input: brand, platform, campaign goal
- Output: marketing model selection (AIDA/STP/4P/Funnel etc.), reasoning, campaign angle, funnel stage, target emotion, CTA strategy, suggested topics

### 6. Lịch nội dung (Content Calendar)
- 7 or 30-day AI-generated content plan
- Status workflow: draft → review → approved → scheduled → posted
- Calendar and list view

### 7. Phê duyệt (Approval Dashboard)
- Review pending content plans
- Approve/reject with reason
- Publish to Metricool via webhook

## API Routes

- `GET/POST /api/brands` — Store management
- `GET/PUT/DELETE /api/brands/:id`
- `GET/POST /api/reviews` — Review management
- `POST /api/reviews/:id/generate-reply` — AI reply generation
- `POST /api/reviews/:id/reply` — Save reply
- `GET /api/reviews/stats` — Review statistics
- `POST /api/content/generate` — AI content generation
- `POST /api/content/strategy` — AI strategy generation
- `GET/POST /api/content-plans` — Content plans
- `POST /api/content-plans/generate` — AI-generated content plan
- `GET/PUT/DELETE /api/content-plans/:id`
- `POST /api/content-plans/:id/approve`
- `POST /api/content-plans/:id/reject`
- `POST /api/content-plans/:id/publish` — Trigger Metricool webhook

## AI Messenger Booking Bot

Route: `/messenger` (frontend), `/api/messenger/*` (API)

Flow: Customer messages Facebook Page → GPT-4o collects info in German (service, date, time, name, phone) → saves appointment → notifies manager PSID via Messenger → Manager replies "JA" (confirm) or "NEIN" (reject) → AI sends response to customer.

**DB Tables**: `messenger_configs` (per-brand: page_access_token, verify_token, manager_psid, page_id), `messenger_sessions` (per-user PSID conversation state + history), `appointments` (booking records with status)

**Key API endpoints**:
- `GET /api/messenger/webhook` — Meta webhook verification
- `POST /api/messenger/webhook` — Receive and process messages
- `GET/POST /api/messenger/config/:brandId` — Config CRUD
- `GET /api/messenger/appointments` — List bookings
- `PATCH /api/messenger/appointments/:id/status` — Manual confirm/reject
- `GET /api/messenger/overview` — All brands with stats

**Setup**: Facebook Developer App → Messenger → Webhooks → Callback URL = `{domain}/api/messenger/webhook`, subscribe: `messages, messaging_postbacks`. Token from Page Access Tokens.

## Environment Variables

- `DATABASE_URL` — Auto-provisioned by Replit
- `AI_INTEGRATIONS_GEMINI_BASE_URL` — Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_GEMINI_API_KEY` — Auto-set by Replit AI Integrations
- `METRICOOL_WEBHOOK_URL` — Optional: set to trigger Metricool publishing
- `OPENAI_API_KEY` — GPT-4o for Messenger booking bot + content generation
- `GROK_API_KEY` — Grok for trend analysis in AI pipeline
- `MAKE_WEBHOOK_URL` — Make.com automation webhook

## Development

```bash
# Run API server
pnpm --filter @workspace/api-server run dev

# Run frontend
pnpm --filter @workspace/marketing-platform run dev

# Push DB changes
pnpm --filter @workspace/db run push

# Run codegen after OpenAPI spec changes
pnpm --filter @workspace/api-spec run codegen
```
