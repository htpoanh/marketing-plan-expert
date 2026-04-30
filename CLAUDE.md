# CLAUDE.md — Ads Strategy Agent Module (v2)

> **Project:** `marketing-plan-expert` monorepo  
> **Stack:** Vite+React 18+TS / Express 5 / Postgres+Drizzle / OpenAPI+Orval / pnpm workspaces  
> **Mục đích file này:** Hướng dẫn Claude Code khi làm việc trên dự án này để thêm module **Ads Strategy Agent** (M1 Audience + M2 Keywords + M3 Performance + M4 Trend).

---

## 1. Bối cảnh dự án

### 1.1 Stack thực tế (KHÔNG được thay đổi)

**Frontend** (`artifacts/marketing-platform/`):
- React 18 + TypeScript 5.9 strict mode
- Vite (dev + build)
- TailwindCSS 4 (oxide engine) + shadcn/ui (Radix UI)
- TanStack Query (data fetching)
- React Hook Form + Zod (forms)
- Wouter (routing)
- Recharts (charts)
- Framer Motion (animations)
- Sonner (toasts)

**Backend** (`artifacts/api-server/`):
- Node.js 24 + TypeScript
- Express 5
- express-session + connect-pg-simple
- CORS + cookie auth (1 admin user, env-based)

**Database**:
- PostgreSQL + Drizzle ORM + drizzle-zod
- Existing tables: `brands`, `reviews`, `content_plans`, `conversations`, `messages`, `appointments`, `messenger_configs`, `messenger_sessions`, `ai_profiles`, `automation_settings`, `automation_logs`, `pipeline_runs`, `strategies`, `ai_agent_configs`

**API Layer** (CRITICAL):
- OpenAPI spec là **single source of truth** — tại `lib/api-spec/`
- Orval codegen tự động:
  - `lib/api-zod/` — Zod schemas
  - `lib/api-client-react/` — React Query hooks
- Frontend **CHỈ được gọi backend qua hooks generated**, không gọi API ngoài (Claude/Gemini/GPT/Grok) trực tiếp từ frontend

**AI Multi-Model**:
- `@google/genai` — Gemini (content generation, images)
- `@anthropic-ai/sdk` — Claude (refinement, review reply)
- `openai` — GPT-4o (Messenger booking, strategy hiện tại)
- Grok (xAI REST) — trend analysis

**Monorepo** (pnpm workspaces):
```
artifacts/
├── api-server/         # Express backend
├── marketing-platform/ # React frontend  
└── mockup-sandbox/
lib/
├── db/                 # Drizzle schema + migrations
├── api-spec/           # OpenAPI spec (source of truth)
├── api-zod/            # Generated Zod schemas
├── api-client-react/   # Generated React Query hooks
├── integrations-anthropic/
├── integrations-google/
├── integrations-openai/
└── integrations-xai/
scripts/                # Seed, migrations
```

**Deployment**:
- VPS với pm2 + nginx + Let's Encrypt
- Vietnamese UI + German customer responses

### 1.2 Mục tiêu nâng cấp

Thêm module **Ads Strategy Agent** vào feature **Strategy đã có** (KHÔNG tạo app mới), gồm 4 chức năng:

| Module | AI Model | Input | Output | Use case |
|---|---|---|---|---|
| **M1 — Audience Targeting** | Claude Haiku | brand_id + service + goal | Personas + Meta/Google targeting JSON | Set ads đúng người |
| **M2 — Keyword Weight** | Gemini Flash | brand_id + service + competitors | 4 nhóm keyword theo intent | Set keyword có sức nặng |
| **M3 — Performance Reality** | Claude Sonnet | CSV ads data + goal | Phân tích + budget reallocation | Tối ưu ngân sách thật |
| **M4 — Trend Pulse** | Grok | brand_id + region | Real-time trends Đức + Bayern | Capitalize trend nhanh |

### 1.3 Nguyên tắc thiết kế (theo đúng pattern hiện tại)

1. **OpenAPI-first**: Mọi endpoint mới phải khai báo trong `lib/api-spec/` TRƯỚC, sau đó Orval codegen, frontend dùng hooks.
2. **Drizzle schema-first**: Mọi table mới khai báo trong `lib/db/schema.ts`, generate migration, run migrate.
3. **AI model isolation**: Mỗi AI provider có integration package riêng (`lib/integrations-*`). Không gọi SDK trực tiếp từ feature code.
4. **Multi-tenancy ready**: Dù hiện tại 1 admin, code phải support `brand_id` foreign key cho future multi-tenant.
5. **Vietnamese UI, German customer-facing**: UI strings tiếng Việt, output ads/copy generated tiếng Đức.
6. **Type-safe end-to-end**: Zero `any`, zero `unknown` ngoài tầng integration. Tất cả qua Zod validation.

---

## 2. Quy trình bắt buộc khi Claude Code làm việc

### 2.1 Trước khi viết code (BẮT BUỘC)

1. **Đọc toàn bộ `/docs/` folder** để hiểu spec.
2. **Audit codebase hiện tại** — focus 5 điểm:
   - `lib/db/schema.ts` — table `brands`, `strategies`, `ai_agent_configs` có columns gì
   - `lib/api-spec/` — pattern khai báo OpenAPI hiện tại
   - `artifacts/api-server/src/routes/` — pattern viết route hiện tại
   - `artifacts/marketing-platform/src/features/strategy/` — feature Strategy hiện có thế nào
   - `lib/integrations-anthropic/` — wrapper Claude đã có chưa, signature thế nào
3. **Báo cáo phát hiện trong `AUDIT_REPORT.md`** trước khi sửa.
4. **Chờ confirm** từ user trước khi modify >3 file.

### 2.2 Khi viết code

**Order bắt buộc**:
1. **Schema first** — update `lib/db/schema.ts`, generate migration, KHÔNG run migration cho đến khi user confirm
2. **OpenAPI second** — khai báo endpoints trong `lib/api-spec/`, run Orval codegen
3. **Backend route third** — implement endpoint trong `artifacts/api-server/`
4. **Frontend last** — UI dùng generated React Query hooks

**Tuân thủ pattern hiện tại**:
- Nếu existing code dùng `Repository` pattern → dùng theo
- Nếu dùng Drizzle queries trực tiếp → cũng vậy
- KHÔNG tự áp pattern mới (Service layer, CQRS, etc.) trừ khi user đề nghị

### 2.3 Sau khi viết code

1. Run `pnpm typecheck` ở từng workspace — phải pass 100%
2. Run `pnpm test` nếu có test suite
3. Manual test với seed data
4. Update `CHANGELOG.md` ở root
5. Update OpenAPI spec version

---

## 3. Architecture mục tiêu

### 3.1 Database changes (additive, không phá schema cũ)

Thêm vào `lib/db/schema.ts`:

```typescript
// Extend brands table với ads context
// (KHÔNG drop column cũ, chỉ ADD)
ALTER TABLE brands ADD COLUMN ads_context JSONB;
ALTER TABLE brands ADD COLUMN service_radius_km INTEGER;
ALTER TABLE brands ADD COLUMN avg_ticket_size_eur DECIMAL(10,2);

// Bảng mới
CREATE TABLE ads_reports (
  id UUID PRIMARY KEY,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  module VARCHAR(20) NOT NULL,  -- 'audience' | 'keyword' | 'performance' | 'trend'
  input JSONB NOT NULL,
  output JSONB NOT NULL,
  ai_model VARCHAR(50) NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_eur DECIMAL(10,4),
  latency_ms INTEGER,
  user_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ads_reports_brand_module ON ads_reports(brand_id, module);
CREATE INDEX idx_ads_reports_created_at ON ads_reports(created_at DESC);
```

### 3.2 OpenAPI endpoints mới

Thêm vào `lib/api-spec/` (tag: `ads-strategy`):

```yaml
POST /api/ads-strategy/audience       # M1: generate personas + targeting
POST /api/ads-strategy/keywords       # M2: generate 4 keyword groups
POST /api/ads-strategy/performance    # M3: analyze CSV
POST /api/ads-strategy/trend          # M4: trend pulse
GET  /api/ads-strategy/reports        # list saved reports (filter by brand, module)
GET  /api/ads-strategy/reports/:id    # get single report
PATCH /api/ads-strategy/reports/:id   # update user_notes
DELETE /api/ads-strategy/reports/:id
```

### 3.3 Backend structure

```
artifacts/api-server/src/
├── routes/
│   └── ads-strategy/
│       ├── index.ts              # router setup
│       ├── audience.handler.ts   # M1 endpoint
│       ├── keywords.handler.ts   # M2 endpoint  
│       ├── performance.handler.ts # M3 endpoint
│       ├── trend.handler.ts      # M4 endpoint
│       └── reports.handler.ts    # CRUD reports
├── services/
│   └── ads-strategy/
│       ├── audience.service.ts   # business logic M1
│       ├── keywords.service.ts
│       ├── performance.service.ts
│       ├── trend.service.ts
│       ├── csv-parser.ts         # M3 CSV normalization
│       └── prompt-builder.ts     # share prompt template logic
└── repositories/
    └── ads-reports.repo.ts       # Drizzle queries
```

### 3.4 Frontend structure

Extend feature "Strategy" có sẵn:

```
artifacts/marketing-platform/src/features/strategy/
├── (existing files)
└── ads/                          # NEW subfeature
    ├── AdsStrategyPage.tsx       # main page với 4 tabs
    ├── AudienceTab.tsx
    ├── KeywordsTab.tsx
    ├── PerformanceTab.tsx
    ├── TrendTab.tsx
    ├── components/
    │   ├── BrandSelector.tsx     # reuse từ existing nếu có
    │   ├── PersonaCard.tsx
    │   ├── KeywordTable.tsx
    │   ├── CSVDropzone.tsx
    │   ├── ReportView.tsx
    │   └── TokenUsageBadge.tsx
    └── hooks/
        ├── useAudienceMutation.ts  # wrapper around generated hook
        ├── useKeywordsMutation.ts
        └── ...
```

### 3.5 AI integration layer

Thêm methods vào existing integration packages, KHÔNG tạo package mới:

```typescript
// lib/integrations-anthropic/src/index.ts (extend)
export async function generateAudienceStrategy(input: AudienceInput): Promise<AudienceOutput>
export async function analyzePerformance(input: PerformanceInput): Promise<PerformanceOutput>

// lib/integrations-google/src/index.ts (extend)  
export async function generateKeywords(input: KeywordsInput): Promise<KeywordsOutput>

// lib/integrations-xai/src/index.ts (extend)
export async function getTrendPulse(input: TrendInput): Promise<TrendOutput>
```

---

## 4. Files đi kèm trong tài liệu này

Đọc theo thứ tự:

1. **`CLAUDE.md`** (file này) — overview + quy trình
2. **`docs/ARCHITECTURE.md`** — chi tiết kỹ thuật từng module + DB schema + API spec
3. **`docs/PROMPTS.md`** — prompt templates cho 4 AI providers
4. **`docs/DATA_SCHEMAS.md`** — TypeScript types + Zod schemas
5. **`docs/INTEGRATION_GUIDE.md`** — cách extend integration packages
6. **`docs/UPGRADE_PLAN.md`** — roadmap 4 phase (P0 audit + P1-P3 implementation)

---

## 5. Nguyên tắc làm việc với Claude Code (CRITICAL)

### 5.1 KHÔNG bao giờ làm

- ❌ KHÔNG gọi AI API trực tiếp từ frontend (vi phạm OpenAPI-first principle)
- ❌ KHÔNG bypass Orval codegen — luôn update OpenAPI spec, generate, rồi dùng hooks
- ❌ KHÔNG tự ý cài npm package mới — list ra trong AUDIT, đợi user approve
- ❌ KHÔNG drop hoặc rename existing column trong `brands`/`strategies` table
- ❌ KHÔNG run migration tự động — chỉ generate, để user run
- ❌ KHÔNG hardcode `brand_id` hoặc bất kỳ ID nào
- ❌ KHÔNG hardcode API key (tất cả qua env vars)
- ❌ KHÔNG dùng `any` type
- ❌ KHÔNG duplicate code đã có trong `lib/integrations-*`
- ❌ KHÔNG tạo app mới trong monorepo (extend Strategy có sẵn)
- ❌ KHÔNG dùng tiếng Anh cho UI strings (Vietnamese cho UI)
- ❌ KHÔNG gọi production database trong test

### 5.2 LUÔN làm

- ✅ LUÔN scan `lib/db/schema.ts` trước khi propose schema change
- ✅ LUÔN update OpenAPI spec TRƯỚC khi implement endpoint
- ✅ LUÔN reuse generated hooks từ `lib/api-client-react/`
- ✅ LUÔN dùng Drizzle prepared queries
- ✅ LUÔN log token usage vào `ads_reports` table
- ✅ LUÔN handle multilang đúng: UI Vietnamese, AI output German
- ✅ LUÔN write Zod schemas trong `drizzle-zod` style
- ✅ LUÔN test typecheck trước khi commit
- ✅ LUÔN respect existing code style (Prettier config, ESLint rules)
- ✅ LUÔN backward compatible với existing features

### 5.3 Khi không chắc

User là **IT engineer + đã build dự án này**. Khi gặp ambiguity:
- **DỪNG** — không đoán
- **HỎI** với options cụ thể (A vs B vs C)
- User trả lời nhanh, không cần Claude Code tự xoay

---

## 6. Acceptance criteria

Module được coi là done khi:

**Backend**:
- [ ] OpenAPI spec đầy đủ 8 endpoints, Orval generate không lỗi
- [ ] 4 service methods cho 4 modules + CRUD reports
- [ ] Migration script không phá data hiện tại
- [ ] Token usage track đầy đủ
- [ ] Error handling đúng pattern (chuẩn HTTP status code)
- [ ] Integration tests cho 4 endpoints

**Frontend**:
- [ ] 4 tabs UI với form + result view
- [ ] Reuse generated React Query hooks
- [ ] Loading + error + empty states
- [ ] Mobile responsive (test trên iPhone Safari)
- [ ] Recharts cho M3 visualization
- [ ] Export PDF/Markdown/JSON
- [ ] Token cost hiển thị real-time
- [ ] List reports đã save (filter theo brand + module)

**End-to-end**:
- [ ] Pick brand → run M1 → save → view lại được
- [ ] Upload CSV ads → M3 phân tích đúng → export PDF
- [ ] Cost dashboard hiển thị tổng AI spend tháng này
- [ ] Vietnamese UI hoạt động, German output content đúng

---

## 7. Quick reference

| Câu hỏi | Trả lời ở đâu |
|---|---|
| Schema DB cụ thể? | `docs/ARCHITECTURE.md` mục 2 |
| Prompt cho M1? | `docs/PROMPTS.md` mục 2 |
| Zod schema input M2? | `docs/DATA_SCHEMAS.md` mục 3 |
| Cách extend integration-anthropic? | `docs/INTEGRATION_GUIDE.md` mục 1 |
| Roadmap timeline? | `docs/UPGRADE_PLAN.md` |

---

**Last updated:** 2026-04-30  
**Project:** marketing-plan-expert  
**Maintainer:** Phuong Oanh Waldegger
