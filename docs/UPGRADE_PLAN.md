# UPGRADE_PLAN.md — Roadmap (v2)

> Kế hoạch nâng cấp `marketing-plan-expert` với module Ads Strategy Agent.  
> **5 phase**, mỗi phase 1 cuối tuần (~8-12h work).

---

## Phase 0 — Discovery & Audit (BẮT BUỘC, 2-3 giờ)

> KHÔNG được skip. Output là `AUDIT_REPORT.md` ở root project.

### 0.1 Việc Claude Code phải làm

#### Scan workspace structure
```bash
# List all packages
cat pnpm-workspace.yaml
ls artifacts/ lib/

# Per workspace: package.json, tsconfig
for p in artifacts/* lib/*; do
  echo "=== $p ==="
  cat $p/package.json | jq '{ name, version, dependencies: (.dependencies | keys) }'
done
```

#### Scan Drizzle schema hiện tại
```bash
cat lib/db/schema.ts                    # toàn bộ tables
ls lib/db/migrations/                   # existing migrations
cat lib/db/migrations/*.sql | head -200 # latest migration sample
```

Document:
- Bảng `brands` có columns gì hiện tại
- Bảng `strategies` có columns gì
- Bảng `ai_agent_configs` dùng thế nào
- Indexes hiện có
- Có pattern soft-delete không (`deleted_at`)?
- Có `created_by`/`updated_by` không?

#### Scan OpenAPI spec
```bash
ls lib/api-spec/
cat lib/api-spec/openapi.yaml | head -100
# hoặc nếu là split files:
ls lib/api-spec/paths/ lib/api-spec/components/
```

Document:
- Spec là 1 file hay split?
- Pattern naming endpoints (kebab-case? camelCase?)
- Common components đã có (errors, pagination, etc.)
- Auth scheme (sessionAuth? bearerAuth?)
- Có versioning không?

#### Scan backend routes
```bash
ls artifacts/api-server/src/routes/
ls artifacts/api-server/src/services/
ls artifacts/api-server/src/repositories/  # nếu có
cat artifacts/api-server/src/routes/strategies/*.ts  # pattern
```

Document:
- Router structure (theo feature folder?)
- Middleware order (auth, validation, error)
- Error handling pattern
- Có service layer hay handler gọi DB trực tiếp?

#### Scan frontend Strategy feature
```bash
ls artifacts/marketing-platform/src/features/strategy/
cat artifacts/marketing-platform/src/features/strategy/index.tsx | head -50
```

Document:
- Component structure (atomic? feature-based?)
- Form pattern (RHF + Zod resolver setup)
- Generated hooks usage example
- Routing pattern in Wouter
- shadcn/ui components đã dùng

#### Scan AI integrations
```bash
cat lib/integrations-anthropic/src/index.ts
cat lib/integrations-google/src/index.ts
cat lib/integrations-xai/src/index.ts
cat lib/integrations-openai/src/index.ts
```

Document per package:
- Public API signature
- Client initialization (singleton? per-call?)
- Error classes used
- Retry logic implemented?
- Token tracking implemented?
- Test coverage

### 0.2 Output: `AUDIT_REPORT.md`

Format bắt buộc:

```markdown
# Audit Report — marketing-plan-expert
Date: [auto]
Auditor: Claude Code

## 1. Workspace map
### Apps
- artifacts/api-server v X.X — Express, deps: [...]
- artifacts/marketing-platform v X.X — Vite+React, deps: [...]
- artifacts/mockup-sandbox — purpose: ...

### Libraries
- lib/db — Drizzle ORM
- lib/api-spec — OpenAPI 3.1
- ...

## 2. Database state
### brands table
Existing columns: [list]
Status: ready for ads_context extension / needs migration / ...

### Other relevant tables
- strategies: [columns + purpose]
- ai_agent_configs: [columns + purpose]

## 3. OpenAPI patterns detected
- Endpoint naming: ...
- Auth: ...
- Common components reused: ...

## 4. Backend patterns detected
- Service layer: yes/no
- Repository pattern: yes/no
- Error handling: [describe]

## 5. Frontend patterns detected
- Routing: Wouter, pattern: ...
- Forms: RHF + Zod, example file: ...
- Generated hooks usage: example

## 6. AI integration state
| Package | Has wrapper | Has retry | Has token tracking | Has tests |
|---|---|---|---|---|
| anthropic | yes | no | partial | yes |
| google | ... | ... | ... | ... |

## 7. Recommendations before implementation
1. [Specific recommendation]
2. ...

## 8. Risks identified
- [Risk]: [mitigation]

## 9. Proposed file additions
[list, grouped by package]

## 10. Files requiring modification
[list with specific reason for each]

## 11. Files left untouched
[list categories — UI components, tests, docs, etc.]

## 12. Estimated effort
- Phase 1: X hours
- Phase 2: X hours
- Phase 3: X hours
- Phase 4: X hours
- Total: X hours

## 13. Questions for user
1. [Specific question with options]
2. ...
```

### 0.3 STOP và đợi user

Sau khi tạo report, STOP. KHÔNG viết feature code. Đợi user:
- Approve report → tiếp Phase 1
- Adjust questions trong report → update plan
- Reject toàn bộ → rework approach

---

## Phase 1 — Foundation (Cuối tuần 1, ~10-12h)

> Build infrastructure: DB schema, OpenAPI, integration extensions, CRUD reports endpoint. CHƯA có UI feature module.

### Deliverables

#### 1.1 DB schema + migration (2h)
- [ ] Update `lib/db/schema.ts`:
  - Extend `brands` table với 7 cột mới
  - Add `ads_reports` table
  - Add enums (`ads_module`, `ads_status`)
  - Define relations
- [ ] Generate migration: `pnpm db:generate`
- [ ] Review migration SQL — không phá data hiện tại
- [ ] Seed script: `scripts/seed-ads-context.ts`
  - Seed `ads_context` cho 7 brands của Thai Hoang (Paradise Nails Kempten/Memmingen/Lindau/Friedrichshafen, Happy Wok, Asia Supermarkt Kempten/Memmingen)
  - Data thật từ user (require user input nếu chưa có)
- [ ] **DON'T RUN MIGRATION** — chỉ generate, đợi user run

#### 1.2 OpenAPI spec + codegen (2.5h)
- [ ] Add `lib/api-spec/paths/ads-strategy.yaml` với 8 endpoints
- [ ] Add `lib/api-spec/components/schemas/ads-strategy.yaml`
- [ ] Reuse common components (errors, pagination)
- [ ] Run codegen: `pnpm --filter @lib/api-zod generate && pnpm --filter @lib/api-client-react generate`
- [ ] Verify generated files compile

#### 1.3 Repository layer (1h)
- [ ] `artifacts/api-server/src/repositories/ads-reports.repo.ts`
- [ ] Methods: `create`, `findById`, `list`, `update`, `delete`, `getCostSummary`
- [ ] Unit tests với in-memory DB

#### 1.4 Reports CRUD endpoints (2h)
- [ ] `artifacts/api-server/src/routes/ads-strategy/reports.handler.ts`
- [ ] `GET /api/ads-strategy/reports` (with filters)
- [ ] `GET /api/ads-strategy/reports/:id`
- [ ] `PATCH /api/ads-strategy/reports/:id` (user_notes only)
- [ ] `DELETE /api/ads-strategy/reports/:id`
- [ ] Auth middleware integration
- [ ] Integration tests

#### 1.5 Integration package extensions (3h)
- [ ] Extend `lib/integrations-anthropic/src/ads-strategy/`
  - `audience.ts` (CHƯA implement service, chỉ stub function)
  - `performance.ts` (stub)
  - `types.ts`
- [ ] Extend `lib/integrations-google/src/ads-strategy/`
  - `keywords.ts` (stub)
- [ ] Extend `lib/integrations-xai/src/ads-strategy/`
  - `trend.ts` (stub)
- [ ] Add shared `withRetry`, error classes nếu chưa có

#### 1.6 Tests + cleanup (1h)
- [ ] All packages: `pnpm typecheck` pass
- [ ] All packages: `pnpm test` pass
- [ ] Update CHANGELOG.md ở root
- [ ] Commit: "feat(ads-strategy): foundation — DB schema, OpenAPI, repositories"

### Acceptance test Phase 1
```bash
# Migration runs cleanly
pnpm db:migrate

# Seed populates Thai Hoang brands
pnpm tsx scripts/seed-ads-context.ts

# API endpoints respond (with empty data)
curl -X GET http://localhost:3000/api/ads-strategy/reports \
  -H "Cookie: connect.sid=..." \
  → 200 OK { data: [], total: 0, has_more: false }

# Codegen produces hooks
ls lib/api-client-react/src/ads-strategy/
→ generated.ts với useListAdsReports, useGetAdsReport, etc.
```

---

## Phase 2 — M2 Keyword + M1 Audience (Cuối tuần 2, ~12h)

> Implement 2 module dùng cùng pattern. M2 trước vì rẻ hơn, dễ test.

### Deliverables

#### 2.1 Prompt builder (2h)
- [ ] `artifacts/api-server/src/services/ads-strategy/prompt-builder.ts`
  - `buildBrandContextSection(brand)`
  - `buildAudiencePrompt(input, brand)`
  - `buildKeywordsPrompt(input, brand)`
- [ ] Prompt constants in `services/ads-strategy/prompts/`
- [ ] Unit tests: placeholder replacement

#### 2.2 M2 Keyword service (3h)
- [ ] Service: `services/ads-strategy/keywords.service.ts`
- [ ] Implement `generateKeywords` trong `lib/integrations-google` (replace stub)
- [ ] Endpoint handler: `routes/ads-strategy/keywords.handler.ts`
- [ ] Validate output với Zod
- [ ] Save to ads_reports
- [ ] Integration test với mock Gemini

#### 2.3 M1 Audience service (3h)
- [ ] Service: `services/ads-strategy/audience.service.ts`
- [ ] Implement `generateAudienceStrategy` trong `lib/integrations-anthropic`
- [ ] Endpoint handler
- [ ] Validate output
- [ ] Integration test với mock Anthropic

#### 2.4 Frontend M2 + M1 UI (3.5h)
- [ ] `features/strategy/ads/AdsStrategyPage.tsx` — main page với 4 tabs (M3/M4 disabled)
- [ ] `features/strategy/ads/KeywordsTab.tsx`:
  - Form (RHF + zodResolver)
  - Brand selector (reuse existing nếu có, hoặc tạo mới)
  - 4 result tables với recharts/shadcn
  - Export CSV button
- [ ] `features/strategy/ads/AudienceTab.tsx`:
  - Form
  - 4 result tabs (Personas/Meta/Google/Negative)
  - Persona cards
  - Copy-to-clipboard JSON
  - Budget split pie chart
- [ ] Reuse `useGenerateKeywords`, `useGenerateAudience` từ generated hooks
- [ ] Loading/error/empty states
- [ ] Add route trong Wouter config

#### 2.5 Token cost dashboard (0.5h)
- [ ] Component `features/strategy/ads/components/CostDashboard.tsx`
- [ ] Hiển thị tổng cost tháng này (group by module + provider)
- [ ] Use existing `getCostSummary` repo method

### Acceptance test Phase 2
```
1. User mở /strategy/ads
2. Click tab "Keywords"
3. Chọn Paradise Nails Kempten, nhập "Gel-Nägel Sommer 2026", click Generate
4. < 10s sau, 4 bảng keyword appear
5. Click Export CSV → download Google Ads Editor format
6. Click tab "Audience"
7. Generate cho cùng brand + service
8. < 15s sau, 4 personas + Meta JSON + budget pie chart
9. Click Copy Meta JSON → paste vào Ads Manager → schema hợp lệ
10. Mở "Reports" sidebar → thấy 2 reports vừa tạo
11. Cost dashboard: ~€0.012 used today
```

---

## Phase 3 — M3 Performance Reality (Cuối tuần 3, ~10h)

> M3 phức tạp nhất — CSV upload + parsing + Sonnet analysis + Recharts visualization.

### Deliverables

#### 3.1 CSV parser service (3h)
- [ ] `services/ads-strategy/csv-parser.ts`:
  - `parseAdsCSV(buffer)` — detect Meta vs Google
  - `normalizeMetaRow(row)`, `normalizeGoogleRow(row)`
  - `buildAggregateStats(rows)`
  - `selectTopAndBottom(rows, metric, count)`
- [ ] Sample CSVs in `__tests__/fixtures/`:
  - `meta-export-sample.csv`
  - `google-ads-sample.csv`
  - `malformed-sample.csv`
- [ ] Unit tests cho mỗi format

#### 3.2 M3 service + integration (2.5h)
- [ ] Implement `analyzePerformance` trong `lib/integrations-anthropic`
- [ ] Service: `services/ads-strategy/performance.service.ts`
- [ ] Endpoint: `routes/ads-strategy/performance.handler.ts` với multer
- [ ] Multipart parsing
- [ ] Validate CSV size limit (10MB)
- [ ] Integration test

#### 3.3 Frontend M3 (3.5h)
- [ ] `features/strategy/ads/PerformanceTab.tsx`
- [ ] `components/CSVDropzone.tsx`:
  - Drag-drop area
  - Preview rows
  - Format detection display
  - Error states (wrong format, too big, malformed)
- [ ] `components/PerformanceReport.tsx`:
  - Executive summary card
  - Current state với KPI cards
  - "What's working" list with confidence badges
  - "What's wasting" table với action buttons
  - Hypothesis cards (3) với A/B test design
  - Budget reallocation Sankey diagram (optional, hoặc table)
  - Risks expandable section
- [ ] Recharts: budget reallocation flow, KPI trend if multiple reports
- [ ] Export PDF (use `react-pdf` hoặc browser print CSS)

#### 3.4 Polish (1h)
- [ ] Mobile responsive cho all 3 tabs (test iPhone Safari)
- [ ] Loading skeletons
- [ ] Error recovery actions
- [ ] Tooltip explanations cho mỗi metric

### Acceptance test Phase 3
```
1. User export ads data từ Meta Ads Manager (30 ngày, ~100 rows)
2. Drag CSV vào dropzone
3. Preview shows first 5 rows + format = "Meta Ads"
4. Fill goal: CPL target €8, avg ticket €45
5. Click Analyze
6. < 30s sau, full report renders
7. Sees 3 hypotheses with sample size, decision criteria
8. Budget reallocation table có concrete € amounts
9. Click Export PDF → 2-3 pages with charts
10. Mobile: open on iPhone Safari → all tabs render đúng
```

---

## Phase 4 — M4 Trend Pulse + Final Polish (Cuối tuần 4, ~8h)

> M4 đơn giản hơn các module khác (chỉ output text), focus polish.

### Deliverables

#### 4.1 M4 Trend (2.5h)
- [ ] Implement `getTrendPulse` trong `lib/integrations-xai`
- [ ] Service + handler
- [ ] Frontend `TrendTab.tsx`:
  - Form (brand + region focus)
  - Trend cards với momentum indicator
  - Source citations (clickable)
  - "Suggested angle" với generate-content button (hook vào existing content feature?)
  - Risk alerts

#### 4.2 Reports hub (2h)
- [ ] `features/strategy/ads/ReportsLibrary.tsx`:
  - List all saved reports
  - Filter: brand, module, date range
  - Search trong notes
  - Bulk delete
  - Export bulk to JSON
- [ ] User notes editor (inline)
- [ ] Compare 2 reports side-by-side (M3 only, useful for week-over-week)

#### 4.3 i18n cleanup (1.5h)
- [ ] Audit hardcoded strings trong 4 tabs
- [ ] Tách thành i18n keys
- [ ] Test toggle DE ↔ VI
- [ ] AI output language flag works correctly

#### 4.4 Documentation (1h)
- [ ] Update `README.md` ở root
- [ ] User guide trong `docs/ADS_STRATEGY_USER_GUIDE.md` (Vietnamese)
- [ ] Admin guide for editing brand context
- [ ] Cost expectation table

#### 4.5 Final QA (1h)
- [ ] Full E2E test: pick brand → run all 4 modules → save → reload → reports persist
- [ ] Token usage dashboard accuracy
- [ ] All ESLint warnings resolved
- [ ] All TypeScript strict checks pass
- [ ] No `console.log` in production code
- [ ] Bundle size check (frontend)
- [ ] pm2 restart trên VPS không lỗi

### Acceptance test Phase 4
```
1. Phuong Oanh dùng module 1 tuần thực tế
2. Chạy ít nhất 5 reports each module
3. Tổng cost dưới €5
4. Module help cải thiện ít nhất 1 ad campaign measurably
5. Không cần Claude Code support thêm trong tuần đó
```

---

## Phase 5 (Optional, post-launch) — Automation

> Sau khi 4 phase chính done, đã có data thực tế.

### Ideas
- **Cron weekly review:** M3 chạy tự động Chủ Nhật với Meta API trực tiếp (skip CSV upload)
- **n8n integration:** Push trend reports vào Telegram/email
- **Cross-module workflow:** M4 trend → auto-generate M1 audience cho trend đó → auto-generate content qua existing content feature
- **A/B prompt versions:** track output quality per version
- **Multi-tenant SaaS:** Mở cho clients khác nếu Phuong Oanh muốn

---

## Rules cho Claude Code khi làm việc trên plan này

### Trước mỗi phase
1. Đọc lại docs (CLAUDE.md, ARCHITECTURE.md, PROMPTS.md, DATA_SCHEMAS.md, INTEGRATION_GUIDE.md)
2. Confirm phase nào sắp làm
3. List deliverables cụ thể
4. Estimate thời gian thực tế (vs estimate trong plan)
5. Identify blockers

### Trong khi làm
1. **Schema first**: Drizzle → migration → OpenAPI → codegen → backend → frontend
2. Mỗi deliverable xong → commit Git riêng
3. Commit message format: `feat(ads-strategy): [phase X.Y] description`
4. Nếu gặp blocker → STOP, hỏi user
5. Test ngay sau khi viết, không gom

### Sau mỗi phase
1. Run full test suite: `pnpm test`
2. Run typecheck: `pnpm typecheck`
3. Generate phase summary với:
   - Files added/modified
   - Test pass rate
   - Bundle size delta
   - Token usage during testing
   - Known issues
   - Demo screenshots (manual)
4. Wait for user acceptance trước khi sang phase tiếp

### Khi gặp ambiguity
- DỪNG, KHÔNG ĐOÁN
- Hỏi user với options A/B/C
- User là engineer, trả lời nhanh
- Đặc biệt cho: schema design choices, naming, UI patterns ngoài existing pattern

---

## Definition of Done — Cả project

- [ ] 4 module M1/M2/M3/M4 fully functional
- [ ] 7 brand contexts có data thật trong DB
- [ ] OpenAPI spec đầy đủ, codegen không lỗi
- [ ] Migration runs cleanly trên dev + production
- [ ] Mobile responsive (Safari iOS test thực tế)
- [ ] Vietnamese UI + German output content
- [ ] Export PDF + Markdown + JSON cho cả 4 module
- [ ] Reports persist + filter + search
- [ ] Cost dashboard chính xác
- [ ] All `pnpm typecheck` pass
- [ ] Test coverage > 60% cho service layer + integration packages
- [ ] No regression in existing features (Brand Manager, Reviews, Strategy hiện tại, Calendar, Approval, Messenger Bot)
- [ ] CHANGELOG cập nhật
- [ ] User guide tiếng Việt
- [ ] Phuong Oanh dùng được 1 tuần liên tục mà không cần fix

---

## Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Existing schema conflict với new columns | Low | High | Phase 0 audit, migration is additive only |
| OpenAPI codegen breaks existing hooks | Low | Medium | Keep schema additions strictly additive |
| AI cost spike | Medium | Low | Token dashboard with alerts, default to cheapest model |
| AI output malformed JSON | High | Medium | Zod validation + retry, prefill trick for Claude |
| Gemini structured output misaligned | Medium | Medium | Test thoroughly Phase 2, fallback to text-then-parse |
| Grok rate limit (xAI not as mature) | Medium | Low | Lower retry count, fail gracefully, M4 is "nice to have" |
| Mobile Safari quirks | Medium | Low | Test early, often |
| User notes/data leak in logs | Low | High | Strict logging review in Phase 0 |
| pm2 deploy disruption | Low | Medium | Stage migration on dev DB first |

---

## Roll-back plan

Nếu phase nào fail:
1. `git revert` commits của phase đó
2. Nếu migration đã run: rollback migration trước (Drizzle support down migration)
3. `pm2 restart` với code cũ
4. Document failure reason trong `POSTMORTEM.md`
5. Không skip phase — fix root cause rồi retry

---

**Ready để bắt đầu Phase 0?** Đưa lệnh này cho Claude Code:

> Đọc CLAUDE.md và toàn bộ /docs/. Chạy Phase 0 audit theo UPGRADE_PLAN.md. Tạo AUDIT_REPORT.md ở root project. KHÔNG viết feature code, chỉ audit và đề xuất.
