# Audit Report — marketing-plan-expert

**Date:** 2026-04-30
**Auditor:** Claude (Anthropic, qua chat web)
**Phase:** 0 — Discovery & Audit (theo `docs/UPGRADE_PLAN.md` mục 0.1-0.2)
**Scope:** Toàn bộ workspace, không sửa code (chỉ tạo report này)
**Goal:** Xác minh giả định trong `CLAUDE.md` + `docs/` có khớp với codebase thực tế không, trước khi vào Phase 1

---

## 1. Workspace map

### 1.1 Apps (`artifacts/`)

| Package | Stack | Mục đích | Notes |
|---|---|---|---|
| `@workspace/api-server` | Express 5, TypeScript 5.9, Node 24 | Backend API | Đã có 14 route files; bundle qua esbuild → CJS |
| `@workspace/marketing-platform` | Vite 7, React 19, TS 5.9 | Frontend SPA | Wouter routing, TanStack Query, shadcn/ui |
| `mockup-sandbox` | Vite | (chưa scan, có thể là playground) | Không liên quan upgrade |

> **Khớp docs:** Có. Stack đúng như `CLAUDE.md` mục 1.1.
> **Lệch nhỏ:** Docs viết React 18, thực tế là **React 19.1.0**. Không ảnh hưởng plan.

### 1.2 Libraries (`lib/`)

| Package | Mục đích | Có sẵn? |
|---|---|---|
| `@workspace/db` | Drizzle schema + connection pool | ✅ |
| `@workspace/api-spec` | OpenAPI 3.1 spec + Orval config | ✅ (single file `openapi.yaml` 1313 dòng) |
| `@workspace/api-zod` | Generated Zod schemas | ✅ |
| `@workspace/api-client-react` | Generated React Query hooks | ✅ |
| `@workspace/integrations-anthropic-ai` | Claude SDK wrapper | ✅ (export: `anthropic` client + `batchProcess`) |
| `@workspace/integrations-gemini-ai` | Gemini SDK wrapper | ✅ (export: `ai` client + `generateImage` + `batchProcess`) |
| `@workspace/integrations-openai` | OpenAI SDK wrapper | ❌ **CHƯA CÓ** |
| `@workspace/integrations-xai` (Grok) | xAI SDK wrapper | ❌ **CHƯA CÓ** |

> **Lệch docs nghiêm trọng:**
> 1. Tên package: docs giả định `lib/integrations-anthropic`, `lib/integrations-google`, `lib/integrations-openai`, `lib/integrations-xai`. Thực tế: chỉ có `integrations-anthropic-ai` + `integrations-gemini-ai` (thêm hậu tố `-ai`, không có `-google`).
> 2. **Không có** integration package cho OpenAI và xAI/Grok. Hiện tại OpenAI client + Grok client được khởi tạo **inline** trong `artifacts/api-server/src/routes/{ad-analysis,messenger,pipeline}.ts` (dùng `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` + `new OpenAI({ baseURL: "https://api.x.ai/v1", apiKey: process.env.GROK_API_KEY })`).
> 3. Có thư mục `lib/integrations/{anthropic_ai_integrations,gemini_ai_integrations}/src/server/` — chỉ chứa file cũ (batch utils, image client), KHÔNG có `package.json`, không phải pnpm workspace package. Đây là **dead code** từ scaffold trước, nên dọn.

### 1.3 Scripts

| File | Mục đích |
|---|---|
| `scripts/seed-brands.ts` | Seed 11 brand ban đầu |
| `scripts/src/hello.ts` | Demo |
| `scripts/post-merge.sh` | Git hook |

> **Lệch nhỏ:** Docs giả định 7 brand Thai Hoang. Thực tế seed có **11 brand** (Happy Wok, 5x Paradise Nails ở các thành phố, 2x Halong/Coco Nails, Asia Supermarkt, Taki Taki, Hafencafé). UPGRADE_PLAN cần update list brand thật.

---

## 2. Database state

### 2.1 Tables hiện có (14 bảng)

```
ai_profiles               brands                  reviews
content_plans             pipeline_runs           conversations
messages                  ai_agent_configs        automation_settings
automation_logs           messenger_configs       messenger_sessions
appointments              strategies
```

### 2.2 `brands` table — chi tiết quan trọng (target của Ads Strategy upgrade)

```ts
brandsTable {
  id: serial PK,                           // ⚠️ INTEGER, không phải UUID như docs giả định
  brandName: text NOT NULL,
  industry: text NOT NULL,
  branchLocation: text NOT NULL,
  address: text,
  phone: text,
  businessHours: text,
  aiProfileId: integer FK ai_profiles,
  targetAudience: text NOT NULL,
  brandVoice: text NOT NULL,
  websiteUrl, facebookUrl, instagramUrl, tiktokUrl: text,
  googlePlaceId: text,
  createdAt: timestamp NOT NULL DEFAULT NOW(),
  updatedAt: timestamp NOT NULL DEFAULT NOW(),
}
```

> **Lệch docs nghiêm trọng:** `docs/ARCHITECTURE.md` và `docs/UPGRADE_PLAN.md` mục 1.1 viết:
> ```
> CREATE TABLE ads_reports ( id UUID PRIMARY KEY, brand_id UUID REFERENCES brands(id) )
> ```
> Nhưng `brands.id` thực tế là **integer (serial)**, không phải UUID. → Phải đổi schema mới sang `serial` để match. Hoặc migration sang UUID toàn bộ (đắt hơn nhiều, không khuyến nghị).
>
> **Khớp:** Cột mới (`ads_context jsonb`, `service_radius_km int`, `avg_ticket_size_eur decimal(10,2)`) có thể ADD COLUMN bình thường, không phá data hiện có.

### 2.3 `strategies` table

```ts
strategiesTable {
  id: serial PK,
  brandId: int FK brands ON DELETE CASCADE,
  platform, campaignGoal: text NOT NULL,
  duration, storeSituation, marketingModel, reasoning,
  campaignAngle, funnelStage, targetEmotion, ctaStrategy: text,
  suggestedTopics: jsonb<string[]> default [],
  createdAt: timestamp,
}
```

> **Pattern hiện tại:** strategies lưu output flat (mỗi field 1 column). Khác pattern docs đề xuất cho `ads_reports` (lưu input/output dưới dạng `jsonb` blob). Quyết định nào tốt hơn → cần xác nhận user.

### 2.4 `ai_agent_configs` table

```ts
aiAgentConfigsTable {
  id: serial PK,
  profileId: int FK ai_profiles NOT NULL,
  agentKey: text NOT NULL,           // 'grok' | 'openai' | etc.
  agentName, aiModel: text NOT NULL,
  defaultRole: text NOT NULL,
  expertiseArea, customInstructions, outputStyle: text,
  isActive: boolean default true,
  createdAt, updatedAt: timestamp,
  UNIQUE(profileId, agentKey),
}
```

> **Quan trọng:** Đã có hệ thống config AI agent per profile. **Có thể tận dụng**: thay vì hardcode model trong code (`claude-haiku`, `gemini-flash`), đọc từ `ai_agent_configs` để user tự chỉnh model trong UI. → Đề xuất Phase 1 thêm 4 agent key mới (`ads-audience`, `ads-keywords`, `ads-performance`, `ads-trend`).

### 2.5 Indexes hiện có

`drizzle-kit push` mode → KHÔNG có file migration để xem index. Dựa trên schema, indexes tự động chỉ là PK + UNIQUE constraints. Không có composite index. Plan thêm cho `ads_reports`:
- `(brand_id, module)` cho list/filter queries
- `(created_at DESC)` cho sort timeline

### 2.6 Patterns DB

- ❌ Không có soft-delete (`deleted_at`) ở bất kỳ table nào
- ❌ Không có `created_by` / `updated_by` (chỉ 1 admin user, không cần)
- ❌ KHÔNG có file migration trong `lib/db/`
- ⚠️ Drizzle config dùng `drizzle-kit push` thẳng từ schema vào DB (script `pnpm push`), KHÔNG generate migration files. → **Risk:** thay đổi schema apply trực tiếp, khó rollback. Cần discussion với user xem có nên switch sang `drizzle-kit generate` + migration files cho production safety.

---

## 3. OpenAPI patterns detected

### 3.1 Cấu trúc file

```
lib/api-spec/
├── openapi.yaml         # 1313 dòng, single file (KHÔNG split)
├── orval.config.ts
└── package.json
```

> Docs `UPGRADE_PLAN.md` mục 1.2 giả định có thể tạo `paths/ads-strategy.yaml` riêng → **Không khả thi** với spec hiện tại (single file). → 2 lựa chọn:
> - A) Append vào `openapi.yaml` cuối (giữ pattern hiện tại)
> - B) Refactor sang split files theo Orval multi-file pattern (∼3-4h work)
>
> Khuyến nghị: **A** trừ khi user muốn dọn spec lớn (1313 dòng) thành chunks dễ maintain.

### 3.2 Path patterns

```
GET    /healthz
POST   /pipeline/run
GET    /pipeline/runs
GET    /pipeline/runs/{id}
GET    /pipeline/marketing-models
GET/POST    /brands
GET/PUT/DELETE  /brands/{id}
GET/POST    /reviews
GET/POST    /reviews/{id}
POST   /reviews/{id}/generate-reply
POST   /reviews/{id}/reply
GET    /reviews/stats
POST   /content/generate
POST   /content/strategy
GET/POST    /content-plans
POST   /content-plans/generate
GET/PUT/DELETE  /content-plans/{id}
POST   /content-plans/{id}/approve
POST   /content-plans/{id}/reject
POST   /content-plans/{id}/publish
```

- Naming: **kebab-case** ✅
- Operation ID: camelCase (`runPipeline`, `getBrand`, etc.)
- Tags: chia theo feature (`pipeline`, `brands`, `reviews`, `content`, `contentPlans`, `approvals`, `strategy`, `health`)

→ Plan thêm tag mới `adsStrategy` với prefix `/ads-strategy/...` ✅ khớp pattern.

### 3.3 Common components

| Component | Có không |
|---|---|
| `ErrorResponse` | ✅ |
| `HealthStatus` | ✅ |
| Pagination wrapper | ❌ Không có. Endpoint list trả mảng trực tiếp |
| Cursor / page params | ❌ |

> **Khuyến nghị:** Trước Phase 1, define `Pagination` schema chuẩn và áp cho `GET /ads-strategy/reports`. Để các list endpoint mới đồng nhất, có thể wrap `{ data: [...], total, hasMore }` thay vì array trần.

### 3.4 Auth scheme trong OpenAPI

```yaml
# (KHÔNG có components.securitySchemes)
# (KHÔNG có security: ở root hoặc per-operation)
```

> **Lệch nghiêm trọng:** Spec **không khai báo auth**, dù backend yêu cầu session cookie cho mọi endpoint trừ public ones. → Codegen client (Orval) cũng không biết về auth → frontend dùng `credentials: "include"` thủ công trong `custom-fetch.ts`. Pattern này hoạt động nhưng:
> - Spec không phản ánh đúng API thực tế (có thể gây lỗi nếu third-party generate client từ spec)
> - Endpoint public (`/healthz`, `/auth/login`) bị mark giống endpoint private
>
> **Khuyến nghị Phase 1:** thêm `securitySchemes.cookieAuth` + `security: [- cookieAuth: []]` ở root + opt-out cho public endpoints.

### 3.5 Versioning

Không có URL versioning (`/v1/...`). Acceptable vì single tenant, single team.

---

## 4. Backend patterns detected

### 4.1 Router structure

```
artifacts/api-server/src/
├── app.ts              # Express setup, CORS, session
├── index.ts            # Listen port
├── routes/
│   ├── index.ts        # Mount routers
│   ├── health.ts
│   ├── auth.ts         # Login/logout/me — 1 admin
│   ├── admin.ts        # Admin password-protected ops
│   ├── brands.ts       # CRUD brand
│   ├── reviews.ts      # Review + auto-reply
│   ├── google-auth.ts  # Google OAuth callback
│   ├── content.ts      # AI content gen
│   ├── content-plans.ts
│   ├── pipeline.ts     # Multi-AI pipeline (Grok + GPT-4o + Gemini + Claude)
│   ├── ai-agents.ts    # CRUD ai_agent_configs
│   ├── ai-profiles.ts
│   ├── automation.ts
│   ├── ad-analysis.ts  # ⚠️ TRÙNG MỤC ĐÍCH M3 — see §4.5
│   └── messenger.ts    # FB Messenger webhook + bot
├── lib/                # Utils
├── middlewares/
└── types/
```

### 4.2 Service / Repository layer

❌ **KHÔNG CÓ** service layer. ❌ **KHÔNG CÓ** repository layer.
Route handler **gọi Drizzle trực tiếp**:

```ts
// routes/brands.ts ví dụ
router.get("/", async (_req, res) => {
  const brands = await db.select().from(brandsTable).orderBy(brandsTable.createdAt);
  res.json(brands);
});
```

Logic phức tạp (pipeline.ts ~500 dòng) gom hết vào 1 file route, mix DB + AI calls + business logic.

> **Decision needed:** docs `UPGRADE_PLAN.md` mục 1.3-1.4 giả định **phải tạo** `services/ads-strategy/` + `repositories/ads-reports.repo.ts`. Có 2 lựa chọn:
> - A) Theo docs: tạo service + repo layer mới chỉ cho ads-strategy. **Nhược:** không đồng nhất với code hiện tại; reviewer sau khó hiểu vì sao chỉ feature này có service layer
> - B) Theo pattern hiện tại: route handler gọi DB + AI trực tiếp, không tạo service layer
> - C) Refactor toàn bộ thành service layer trong Phase 1 (off-scope, +5-8h)
>
> **Khuyến nghị B** vì: ít rủi ro, đồng nhất codebase, đơn giản test hơn (4 module chỉ 4 handler).
>
> Nếu user muốn architecture sạch hơn → đề xuất **B trước, refactor (C) sau Phase 4** khi đã ổn định.

### 4.3 Auth middleware

```ts
// routes/index.ts — global gate
router.use((req, res, next) => {
  const PUBLIC_PREFIXES = ["/healthz", "/auth/", "/reviews/google-auth/callback"];
  if (PUBLIC_PREFIXES.some(p => req.path === p || req.path.startsWith(p))) return next();
  return requireAdmin(req, res, next);
});
```

→ Mọi endpoint mới mặc định **bắt buộc đăng nhập admin**. Endpoints `/ads-strategy/*` mới sẽ tự kế thừa, không cần thêm middleware.

### 4.4 Error handling

Pattern đơn giản, không có error class hierarchy:
```ts
try { ... } catch (error) {
  res.status(500).json({ error: "Failed to fetch brands" });  // generic message
}
```

> **Issue:** error gốc không log đủ chi tiết, no error codes, no Zod validation error handling. Nên thêm middleware error handler trong Phase 1.

### 4.5 ⚠️ TRÙNG MỤC ĐÍCH với feature mới — `ad-analysis.ts`

**Đã tồn tại** route `/api/ad-analysis/analyze` (POST) làm việc tương tự **M3 Performance Reality**:

```ts
// routes/ad-analysis.ts
POST /ad-analysis/analyze
Body: { platform, rawData (CSV/text), contentText, brandName, goal }
Response: { ok, platform, analysis: { summary, keyMetrics, strengths, weaknesses,
                                       opportunities, campaigns, quickWins, contentScore } }

Implementation:
- OpenAI gpt-4o (NOT Claude Sonnet như docs đề xuất)
- KHÔNG persist DB (mỗi call mất kết quả)
- KHÔNG track cost
- KHÔNG có form schema validation
- Response: any type
- Frontend page: /analysis (artifacts/marketing-platform/src/pages/analysis/AdAnalysis.tsx, 401 dòng)
```

Endpoint này **không khai báo trong OpenAPI** — frontend gọi qua `fetch()` trực tiếp (vi phạm nguyên tắc OpenAPI-first đã viết trong CLAUDE.md mục 5.1).

**Decision quan trọng cho user:**
- A) **Replace** `/ad-analysis/*` bằng `/ads-strategy/performance` mới (Claude Sonnet, persist DB, type-safe). Xoá page `/analysis` cũ. Sạch hơn, ít confusion.
- B) **Coexist**: giữ `/ad-analysis/*` cũ làm "quick analysis", thêm `/ads-strategy/*` mới làm version đầy đủ. **Không khuyến nghị** vì user sẽ confuse 2 trang giống nhau.
- C) **Migrate**: chuyển logic `ad-analysis` thành endpoint mới + giữ trang `/analysis` redirect sang trang mới.

→ Khuyến nghị **A** (clean replace).

---

## 5. Frontend patterns detected

### 5.1 Routing — Wouter

```tsx
// App.tsx
<WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
  <Switch>
    <Route path="/login" component={LoginPage} />
    <Route><ProtectedRoutes /></Route>
  </Switch>
</WouterRouter>
```

Protected routes trong `ProtectedRoutes`:
- `/`, `/brands`, `/reviews`, `/reviews/reports`, `/content/generator`, `/content/strategy`, `/pipeline`, `/pipeline/models`, `/agents`, `/calendar`, `/approvals`, `/automation`, `/analysis`, `/messenger`

→ Pattern khớp docs. Plan thêm `/strategy/ads` (4 tab subroute) ✅ khả thi.

### 5.2 Folder structure

```
src/
├── App.tsx
├── main.tsx
├── components/
│   ├── layout/    # AppLayout chung
│   └── ui/        # shadcn components
├── contexts/      # AuthContext
├── hooks/
├── lib/
└── pages/         # Mỗi feature 1 folder
    ├── analysis/AdAnalysis.tsx        # ⚠️ existing
    ├── brands/BrandManager.tsx
    ├── content/{ContentGenerator,StrategyGenerator}.tsx
    ├── ...
```

> **Lệch docs:** Docs `CLAUDE.md` mục 3.4 đề xuất `src/features/strategy/ads/...`. Codebase hiện dùng `src/pages/<feature>/<Component>.tsx`, **KHÔNG có folder `features/`**. → Plan phải đổi sang `src/pages/strategy/ads/...` hoặc `src/pages/ads-strategy/...` để khớp pattern.

### 5.3 Forms

`StrategyGenerator.tsx` dùng `useState` thuần (KHÔNG dùng `react-hook-form`):

```tsx
const [formData, setFormData] = useState({
  brandId: 0, platform: "Đa nền tảng", campaignGoal: "", ...
});
```

> **Lệch docs:** `CLAUDE.md` mục 1.1 viết "React Hook Form + Zod (forms)" + `package.json` có `react-hook-form` và `@hookform/resolvers` dependencies. Nhưng existing pages **không dùng**. → 2 lựa chọn:
> - A) Theo deps đã cài: dùng RHF + Zod cho ads-strategy forms (better DX, validation tốt hơn)
> - B) Theo pattern existing: useState thuần
>
> Khuyến nghị **A**. Có lib sẵn, ads-strategy form có 5+ field nên RHF lợi hơn.

### 5.4 API client usage

✅ **Đúng pattern OpenAPI-first** (đa số):
```tsx
import { useListBrands, useGenerateStrategy } from "@workspace/api-client-react";
const { data: brands } = useListBrands();
const generateMutation = useGenerateStrategy();
```

⚠️ **Vi phạm OpenAPI-first** (vài chỗ):
- `StrategyGenerator.tsx` dòng 41: `fetch("${BASE}/api/content/analyze-situation", ...)` — endpoint không có trong OpenAPI
- `AdAnalysis.tsx` (dự kiến): gọi `/api/ad-analysis/analyze` qua fetch trực tiếp
- `messenger.tsx`: gọi nhiều endpoint `/messenger/*` qua fetch trực tiếp

> **Khuyến nghị:** Chỉ liệt kê. Phase 1 tập trung làm đúng pattern cho **ads-strategy mới**, không sửa technical debt cũ trừ khi user yêu cầu.

### 5.5 shadcn/ui components đã dùng

Đầy đủ Radix-based UI: dialog, accordion, alert, popover, select, tabs, tooltip, toast, etc. → Đủ build mọi UI cho ads-strategy mà không cần thêm component mới.

### 5.6 Charts

Đã có `recharts` ^2.15.2 trong `package.json` → đủ cho M3 visualization (KPI cards, budget reallocation chart).

---

## 6. AI integration state

### 6.1 Hai integration packages

| Package | Public exports | Retry | Token tracking | Tests |
|---|---|---|---|---|
| `@workspace/integrations-anthropic-ai` | `anthropic` (SDK client), `batchProcess`, `batchProcessWithSSE`, `isRateLimitError`, `BatchOptions` | ✅ qua `p-retry` (chỉ trong batch) | ❌ | ❌ |
| `@workspace/integrations-gemini-ai` | `ai` (SDK client), `generateImage`, `batchProcess`, `batchProcessWithSSE` | ✅ qua `p-retry` | ❌ | ❌ |

> **Findings:**
> - Cả 2 package chỉ export client + batch helper. **Không có wrapper function** kiểu `generateText({ model, prompt }) → string`. Mỗi caller tự gọi `anthropic.messages.create({...})` hoặc `ai.models.generateContent({...})`.
> - Không có per-request retry (chỉ batch có).
> - Không có code đo `tokens_input` / `tokens_output` / `cost_eur` (cần đo trong Phase 1 cho `ads_reports`).
> - **CHƯA CÓ** `lib/integrations-openai/` và `lib/integrations-xai/` packages.

### 6.2 OpenAI + Grok inline trong api-server

```ts
// routes/ad-analysis.ts, messenger.ts
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// routes/pipeline.ts
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const grok = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.GROK_API_KEY,
});
```

→ Code không tuân theo nguyên tắc "AI model isolation" trong CLAUDE.md mục 1.3.

> **Decision needed:**
> - A) Tạo 2 package mới `@workspace/integrations-openai` + `@workspace/integrations-xai` trong Phase 1, refactor existing inline calls. **+3-4h work**
> - B) Skip Grok M4 hoàn toàn (như README mục 7 cho phép). Chỉ làm M1+M2+M3. → đỡ 1 package + 1 module
> - C) Inline OpenAI/Grok cho ads-strategy giống pattern existing (đỡ 2 package). Mâu thuẫn CLAUDE.md nhưng đồng nhất codebase.
>
> Khuyến nghị **A** nếu user muốn architecture sạch + tận dụng được M4 trend. **B** nếu muốn ship nhanh.

### 6.3 Lib bổ trợ

- `p-limit` ^x — limit concurrency
- `p-retry` ^x — exponential backoff retry

→ Có sẵn cho cả 2 package.

### 6.4 Dead code đáng dọn

```
lib/integrations/
├── anthropic_ai_integrations/src/server/...   # Empty package, no package.json
└── gemini_ai_integrations/src/server/...      # Empty package, no package.json
```

→ Vestigial directories. Có thể xoá trong cleanup commit. Không ảnh hưởng plan.

---

## 7. Test infrastructure

❌ **Không có test runner** ở bất kỳ package nào (`package.json` không có script `test`).
❌ **Không có** Vitest / Jest config.
❌ **Không có** `__tests__/` folder.

> **Implication cho UPGRADE_PLAN:**
> - Mục 1.3, 1.4, 1.6 yêu cầu "unit tests", "integration tests", "test pass rate" → **CHƯA CÓ INFRA**.
> - Phase 1 cần thêm task: setup Vitest cho api-server + lib/db. **+1.5-2h work**.

---

## 8. Configuration / Env

### 8.1 Env vars hiện dùng

```
DATABASE_URL                          (DB connection)
PORT                                  (api-server)
BASE_PATH                             (frontend, default "/")
SESSION_SECRET                        (express-session)
ADMIN_USERNAME, ADMIN_PASSWORD        (auth)
ALLOWED_ORIGINS                       (CORS, đã sửa trong commit 8f73d1a)
PUBLIC_URL / PUBLIC_DOMAIN            (Google OAuth callback)
AI_INTEGRATIONS_GEMINI_API_KEY        (Gemini)
AI_INTEGRATIONS_GEMINI_BASE_URL       (optional override)
AI_INTEGRATIONS_ANTHROPIC_API_KEY     (Claude)
AI_INTEGRATIONS_ANTHROPIC_BASE_URL    (optional override)
OPENAI_API_KEY                        (GPT-4o)
GROK_API_KEY                          (Grok)
METRICOOL_WEBHOOK_URL, MAKE_WEBHOOK_URL  (optional)
```

→ Ads Strategy không cần thêm env mới (dùng lại 4 key AI có sẵn).

### 8.2 `.env.example` đã có (commit 8f73d1a) ✅

---

## 9. Recommendations before Phase 1

### 9.1 BLOCKER — phải resolve trước Phase 1

1. **brand_id type mismatch**: docs viết UUID, thực tế `serial`. Phải update `docs/ARCHITECTURE.md` mục 2 + `docs/DATA_SCHEMAS.md` mục 1 trước khi codegen, nếu không Zod sẽ generate sai type.
2. **Quyết định service layer**: A (theo docs, tách layer riêng cho ads-strategy) hay B (theo pattern hiện tại, handler gọi DB+AI trực tiếp).
3. **Quyết định OpenAI/xAI integration**: A (tạo 2 package mới) / B (skip M4) / C (inline pattern).
4. **Quyết định ad-analysis cũ**: A (replace) / B (coexist) / C (migrate).
5. **Quyết định OpenAPI multi-file**: append vào single file hay refactor split files.

### 9.2 NON-BLOCKER — có thể defer

6. Sửa `drizzle-kit push` → `drizzle-kit generate` + migration files (tốt hơn cho production rollback).
7. Add OpenAPI security schemes.
8. Add error handler middleware standard.
9. Setup Vitest test infrastructure.
10. Pagination wrapper schema.

### 9.3 Tiến hành an toàn

Trước Phase 1, **commit 1 lần** các sửa đổi `docs/`:
- Update brand_id type → integer
- Adjust integration package names: `integrations-anthropic-ai`, `integrations-gemini-ai`, mới `integrations-openai`, `integrations-xai` (nếu chọn 9.1.3.A)
- Update brand list 7 → 11 trong seed plan
- Update folder pattern `features/` → `pages/`

---

## 10. Risks identified

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `ad-analysis.ts` cũ tạo confusion với module mới | Medium | Medium | Quyết định 9.1.4 trước Phase 1; remove route + page cũ trong Phase 1 |
| `drizzle-kit push` xoá data nếu schema lệch | Medium | High | Backup DB trước migration; switch sang generate+migrate trong Phase 1 |
| OpenAI/Grok inline không retry → fail dưới quota | Low | Medium | Phase 1 tạo wrapper với p-retry |
| Token cost không track → khó audit chi phí | High | Low | Phase 1 thêm cột `tokens_*` + `cost_eur` vào `ads_reports` |
| 1313 dòng OpenAPI — khó merge nếu nhiều người sửa | Low | Low | Skip refactor multi-file lần này |
| React 19 đã ra strict mode — vài lib chưa fully support | Low | Low | Test kỹ ads-strategy với Strict Mode trong dev |
| Cookie `sameSite: strict` chặn third-party iframe | Low | Low | Đã có config phù hợp |

---

## 11. Proposed file additions (giả định Phase 1 chạy theo phương án A)

### `lib/db/src/schema/`
- `ads_reports.ts` (mới)
- `brands.ts` (sửa: ADD `adsContext`, `serviceRadiusKm`, `avgTicketSizeEur`)

### `lib/api-spec/`
- `openapi.yaml` (sửa: append 8 endpoint + 10 schemas mới)

### `lib/api-zod/src/generated/` & `lib/api-client-react/src/generated/`
- Auto-generated qua `pnpm orval`

### `lib/integrations-openai/` (mới, nếu chọn 9.1.3.A)
- `package.json`, `tsconfig.json`, `src/{client.ts,index.ts}`

### `lib/integrations-xai/` (mới, nếu chọn 9.1.3.A)
- `package.json`, `tsconfig.json`, `src/{client.ts,index.ts}`

### `artifacts/api-server/src/routes/`
- `ads-strategy/index.ts` (router mount)
- `ads-strategy/audience.handler.ts`
- `ads-strategy/keywords.handler.ts`
- `ads-strategy/performance.handler.ts`
- `ads-strategy/trend.handler.ts`
- `ads-strategy/reports.handler.ts`

### `artifacts/api-server/src/services/ads-strategy/` (nếu chọn 9.1.2.A)
- `prompt-builder.ts`, `csv-parser.ts`, các `.service.ts`

### `artifacts/marketing-platform/src/pages/strategy/ads/`
- `AdsStrategyPage.tsx` (main 4 tabs)
- `AudienceTab.tsx`, `KeywordsTab.tsx`, `PerformanceTab.tsx`, `TrendTab.tsx`
- `components/{BrandSelector,PersonaCard,KeywordTable,CSVDropzone,ReportView,TokenUsageBadge}.tsx`

### `scripts/`
- `seed-ads-context.ts` (seed `ads_context` cho 11 brand)

### Cleanup (xoá)
- `lib/integrations/anthropic_ai_integrations/`
- `lib/integrations/gemini_ai_integrations/`

### Replace (nếu chọn 9.1.4.A)
- Xoá: `artifacts/api-server/src/routes/ad-analysis.ts`
- Xoá: `artifacts/marketing-platform/src/pages/analysis/AdAnalysis.tsx`
- Xoá: import + route `/analysis` trong `App.tsx`

---

## 12. Files requiring modification (tối thiểu)

| File | Lý do |
|---|---|
| `lib/db/src/schema/brands.ts` | ADD 3 cột mới (additive) |
| `lib/db/src/schema/index.ts` | Export ads_reports schema mới |
| `lib/api-spec/openapi.yaml` | Append 8 endpoint + 10 schemas |
| `pnpm-workspace.yaml` | Không cần (lib/* đã catch-all) |
| `artifacts/api-server/src/routes/index.ts` | Mount router mới `/ads-strategy` |
| `artifacts/marketing-platform/src/App.tsx` | Add route `/strategy/ads` + nav menu item |
| `artifacts/marketing-platform/src/components/layout/AppLayout.tsx` | Thêm menu item Ads Strategy (chưa scan, có thể có sidebar) |
| `docs/ARCHITECTURE.md`, `docs/DATA_SCHEMAS.md`, `docs/UPGRADE_PLAN.md`, `docs/PROMPTS.md` | Sửa UUID → integer; sửa folder pattern; sửa brand list 7 → 11; sửa integration package names |

---

## 13. Files left untouched

- `artifacts/api-server/src/routes/{auth,admin,brands,reviews,google-auth,content,content-plans,pipeline,ai-agents,ai-profiles,automation,messenger,health}.ts` (∼13 files)
- `artifacts/marketing-platform/src/pages/{auth,brands,reviews,content,calendar,approvals,pipeline,agents,automation,messenger}/...`
- `artifacts/marketing-platform/src/components/ui/*` (shadcn primitives)
- `artifacts/api-server/src/lib/*`, `middlewares/*`, `types/*`
- Tất cả `lib/db/src/schema/*` ngoài `brands.ts` + `ads_reports.ts` mới
- Build configs: `vite.config.ts`, `tsconfig.json`, `drizzle.config.ts`, `orval.config.ts`
- `mockup-sandbox/`

---

## 14. Estimated effort (revised vs UPGRADE_PLAN.md)

| Phase | Original (docs) | Revised | Lý do thay đổi |
|---|---|---|---|
| P0 Audit | 2-3h | **Done** (~1h trong chat này) | — |
| P1 Foundation | 10-12h | **13-16h** | +1.5-2h Vitest setup; +3-4h tạo 2 integration package mới (nếu A); +0.5h cleanup ad-analysis cũ |
| P2 M1+M2 | 12h | **10-12h** | Bớt vì có sẵn pattern fetch (giảm RHF setup); thêm CRUD reports đã có |
| P3 M3 | 10h | **9-11h** | Có thể tận dụng UI từ AdAnalysis cũ (recharts pattern, fileupload) |
| P4 M4+Polish | 8h | **6-8h** (hoặc 0h nếu skip M4) | — |
| **Total** | **40-45h** | **38-47h** (M4) / **32-39h** (skip M4) | |

---

## 15. Questions for user — phải trả lời trước Phase 1

1. **brand_id type:** OK với plan giữ `integer` (serial)? Schema docs sẽ update theo. **[Y / đổi sang UUID]**

2. **Service layer:** Pattern handler-gọi-DB-trực-tiếp (như brands.ts) hay tạo service+repository riêng cho ads-strategy?
   **[A: theo docs / B: theo existing pattern / C: refactor toàn bộ — off-scope]**

3. **OpenAI + xAI integration packages:** Tạo `lib/integrations-openai` + `lib/integrations-xai` mới (3-4h)?
   **[A: tạo, làm đủ M1-M4 / B: skip M4, làm 3 module / C: inline tiếp như existing]**

4. **`/api/ad-analysis/*` cũ:** Replace bằng `/api/ads-strategy/performance` mới?
   **[A: replace, xoá analysis page cũ / B: coexist 2 page / C: migrate logic, redirect]**

5. **OpenAPI structure:** Append vào `openapi.yaml` (1313 dòng) hay refactor sang split-file?
   **[A: append / B: refactor multi-file (3-4h)]**

6. **Test infrastructure:** Setup Vitest trong Phase 1 (1.5-2h) hay skip toàn bộ test?
   **[A: setup / B: skip, chấp nhận không có test]**

7. **Drizzle migrations:** Switch từ `kit push` sang `kit generate` + migration files cho safety production?
   **[A: switch trong Phase 1 / B: defer / C: skip]**

8. **Brand context:** Seed `ads_context` cho 11 brand (docs viết 7) — bạn có sẵn data thật cho cả 11 brand không, hay chỉ 1-2 brand làm trước rồi điền dần?
   **[A: có data 11 brand / B: chỉ làm 2 brand đầu / C: scaffold trống, fill sau qua UI]**

9. **AI agent configs integration:** Tận dụng `ai_agent_configs` table có sẵn để user chọn model qua UI thay vì hardcode `claude-haiku`/`gemini-flash`?
   **[A: tận dụng / B: hardcode default model + cho override qua env / C: hardcode tất cả]**

10. **Pagination:** Endpoint `GET /ads-strategy/reports` trả `{data, total, hasMore}` (mới chuẩn) hay array trần (như existing brands/reviews)?
    **[A: object pagination / B: array trần đồng nhất existing]**

---

**Kết:** Codebase **healthy**, cấu trúc đa số khớp docs ngoại trừ 5 lệch quan trọng (brand_id type, integration package names, missing OpenAI/xAI packages, frontend folder pattern, existing ad-analysis trùng mục đích). Phase 1 khả thi sau khi user trả lời 10 câu hỏi mục §15.

Sau khi user approve report + trả lời câu hỏi → bắt đầu Phase 1 với checklist đã revise (38-47h tổng).
