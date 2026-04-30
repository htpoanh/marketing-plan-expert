# ARCHITECTURE.md — Technical Spec (v2)

> Chi tiết kỹ thuật cho 4 module trong monorepo `marketing-plan-expert`.

---

## 1. Tổng quan luồng dữ liệu

```
[Frontend: AdsStrategyPage]
    ↓ user chọn tab + brand + nhập form
    ↓
[React Hook Form + Zod validation]
    ↓
[Generated React Query hook từ lib/api-client-react]
    ↓ HTTP POST /api/ads-strategy/{module}
    ↓ cookie session
    ↓
[Express route handler]
    ↓ auth middleware → validate session
    ↓
[Service layer: services/ads-strategy/{module}.service.ts]
    ↓ load brand context từ DB (brands.ads_context)
    ↓ build prompt với template
    ↓
[Integration package: lib/integrations-{provider}]
    ↓ call AI API với retry + timeout
    ↓ parse + validate output
    ↓
[Service: save to ads_reports table]
    ↓
[Repository: ads-reports.repo.ts]
    ↓ Drizzle insert + return
    ↓
[Handler: HTTP 201 với report ID + output]
    ↓
[Frontend: TanStack Query cache + render UI]
    ↓
[User export PDF/MD/JSON nếu muốn]
```

---

## 2. Database schema changes

### 2.1 Migration file: `lib/db/migrations/XXXX_add_ads_strategy.sql`

```sql
-- Extend brands table (additive, no data loss)
ALTER TABLE brands 
  ADD COLUMN IF NOT EXISTS ads_context JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS service_radius_km INTEGER,
  ADD COLUMN IF NOT EXISTS avg_ticket_size_eur DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS location_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_region VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_country VARCHAR(2) DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS location_coordinates JSONB; -- {lat, lon}

-- New table for ads reports
CREATE TABLE IF NOT EXISTS ads_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  module VARCHAR(20) NOT NULL CHECK (module IN ('audience', 'keyword', 'performance', 'trend')),
  input JSONB NOT NULL,
  output JSONB NOT NULL,
  ai_provider VARCHAR(20) NOT NULL,  -- 'anthropic' | 'google' | 'openai' | 'xai'
  ai_model VARCHAR(50) NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_eur DECIMAL(10,4),
  latency_ms INTEGER,
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'partial')),
  error_message TEXT,
  user_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ads_reports_brand ON ads_reports(brand_id);
CREATE INDEX IF NOT EXISTS idx_ads_reports_module ON ads_reports(module);
CREATE INDEX IF NOT EXISTS idx_ads_reports_created ON ads_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_reports_brand_module ON ads_reports(brand_id, module);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ads_reports_updated_at 
  BEFORE UPDATE ON ads_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2.2 Drizzle schema (`lib/db/schema.ts` extensions)

```typescript
import { pgTable, uuid, varchar, jsonb, integer, decimal, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';
import { brands } from './brands.schema';
import { relations } from 'drizzle-orm';

export const adsModuleEnum = pgEnum('ads_module', ['audience', 'keyword', 'performance', 'trend']);
export const adsStatusEnum = pgEnum('ads_status', ['completed', 'failed', 'partial']);

export const adsReports = pgTable('ads_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
  module: varchar('module', { length: 20 }).notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output').notNull(),
  aiProvider: varchar('ai_provider', { length: 20 }).notNull(),
  aiModel: varchar('ai_model', { length: 50 }).notNull(),
  tokensInput: integer('tokens_input'),
  tokensOutput: integer('tokens_output'),
  costEur: decimal('cost_eur', { precision: 10, scale: 4 }),
  latencyMs: integer('latency_ms'),
  status: varchar('status', { length: 20 }).default('completed'),
  errorMessage: text('error_message'),
  userNotes: text('user_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const adsReportsRelations = relations(adsReports, ({ one }) => ({
  brand: one(brands, {
    fields: [adsReports.brandId],
    references: [brands.id],
  }),
}));

// Drizzle-zod auto-generated schemas
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
export const adsReportInsertSchema = createInsertSchema(adsReports);
export const adsReportSelectSchema = createSelectSchema(adsReports);
```

### 2.3 Brands table extension

```typescript
// In existing brands schema, ADD these columns
export const brands = pgTable('brands', {
  // ... existing columns
  
  // NEW columns for ads strategy
  adsContext: jsonb('ads_context').default({}),
  serviceRadiusKm: integer('service_radius_km'),
  avgTicketSizeEur: decimal('avg_ticket_size_eur', { precision: 10, scale: 2 }),
  locationCity: varchar('location_city', { length: 100 }),
  locationRegion: varchar('location_region', { length: 100 }),
  locationCountry: varchar('location_country', { length: 2 }).default('DE'),
  locationCoordinates: jsonb('location_coordinates'), // { lat: number, lon: number }
});
```

### 2.4 Brand `ads_context` JSONB structure

```typescript
interface BrandAdsContext {
  unique_selling_points: string[];
  brand_voice: {
    tone: string;
    avoid: string[];
    prefer: string[];
    example_phrases: string[];
  };
  pain_points_solved: string[];
  common_objections: Array<{ objection: string; counter: string }>;
  past_campaigns: {
    successful: Array<{ name: string; result: string; learning: string }>;
    failed: Array<{ name: string; reason: string }>;
  };
  seasonality: {
    high_months: number[];      // [5, 6, 7, 8, 9]
    low_months: number[];
    special_events: string[];   // ["Wedding season", "Christmas market"]
  };
  competitors: Array<{
    name: string;
    location: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  primary_customer_persona: string;  // free text description
  visual_identity: {
    primary_colors: string[];
    photography_style: string;
  };
  compliance_notes: string[];
  last_updated: string;  // ISO date
}
```

---

## 3. OpenAPI specification

### 3.1 File location: `lib/api-spec/paths/ads-strategy.yaml`

```yaml
openapi: 3.1.0
info:
  title: Ads Strategy API
  version: 1.0.0

paths:
  /api/ads-strategy/audience:
    post:
      tags: [ads-strategy]
      operationId: generateAudience
      summary: Generate personas + Meta/Google targeting
      security:
        - sessionAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AudienceInput'
      responses:
        '201':
          description: Generated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdsReport'
        '400':
          $ref: '#/components/responses/ValidationError'
        '429':
          $ref: '#/components/responses/RateLimitError'
        '500':
          $ref: '#/components/responses/ServerError'

  /api/ads-strategy/keywords:
    post:
      tags: [ads-strategy]
      operationId: generateKeywords
      # ... similar structure

  /api/ads-strategy/performance:
    post:
      tags: [ads-strategy]
      operationId: analyzePerformance
      requestBody:
        content:
          multipart/form-data:  # for CSV upload
            schema:
              type: object
              properties:
                brand_id: { type: string, format: uuid }
                csv_file: { type: string, format: binary }
                period_days: { type: integer, enum: [7, 14, 30, 90] }
                goal_metric: { type: string, enum: [cpl, roas, cpc, ctr, cpa] }
                goal_value: { type: number }
                avg_ticket_size_eur: { type: number }
                external_context: { type: string }
                output_language: { type: string, enum: [de, vi] }

  /api/ads-strategy/trend:
    post:
      tags: [ads-strategy]
      operationId: getTrendPulse

  /api/ads-strategy/reports:
    get:
      tags: [ads-strategy]
      operationId: listAdsReports
      parameters:
        - { name: brand_id, in: query, schema: { type: string, format: uuid } }
        - { name: module, in: query, schema: { type: string, enum: [audience, keyword, performance, trend] } }
        - { name: limit, in: query, schema: { type: integer, default: 20, maximum: 100 } }
        - { name: offset, in: query, schema: { type: integer, default: 0 } }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/AdsReport' }
                  total: { type: integer }
                  has_more: { type: boolean }

  /api/ads-strategy/reports/{id}:
    get:
      operationId: getAdsReport
    patch:
      operationId: updateAdsReport
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                user_notes: { type: string }
    delete:
      operationId: deleteAdsReport

components:
  schemas:
    AdsReport:
      type: object
      required: [id, brand_id, module, input, output, ai_provider, ai_model, created_at]
      properties:
        id: { type: string, format: uuid }
        brand_id: { type: string, format: uuid }
        module: { type: string, enum: [audience, keyword, performance, trend] }
        input: { type: object, additionalProperties: true }
        output: { type: object, additionalProperties: true }
        ai_provider: { type: string }
        ai_model: { type: string }
        tokens_input: { type: integer, nullable: true }
        tokens_output: { type: integer, nullable: true }
        cost_eur: { type: number, nullable: true }
        latency_ms: { type: integer, nullable: true }
        status: { type: string }
        user_notes: { type: string, nullable: true }
        created_at: { type: string, format: date-time }
        updated_at: { type: string, format: date-time }

    AudienceInput:
      type: object
      required: [brand_id, service, goal, budget_eur_month, avg_ticket_size_eur, output_language]
      properties:
        brand_id: { type: string, format: uuid }
        service: { type: string, minLength: 5, maxLength: 200 }
        goal: { type: string, enum: [booking, awareness, retention] }
        budget_eur_month: { type: number, minimum: 50, maximum: 50000 }
        avg_ticket_size_eur: { type: number, minimum: 1, maximum: 1000 }
        current_customer_notes: { type: string, maxLength: 2000 }
        competitors:
          type: array
          maxItems: 10
          items: { type: string }
        output_language: { type: string, enum: [de, vi] }

    # ... (KeywordsInput, PerformanceInput, TrendInput schemas)
```

### 3.2 Run codegen

```bash
pnpm --filter @lib/api-spec build
pnpm --filter @lib/api-zod generate
pnpm --filter @lib/api-client-react generate
```

This produces:
- `lib/api-zod/src/ads-strategy.ts` — Zod schemas
- `lib/api-client-react/src/ads-strategy.ts` — React Query hooks (auto-named like `useGenerateAudience`, `useListAdsReports`)

---

## 4. Module 1 — Audience Targeting

### 4.1 Service: `services/ads-strategy/audience.service.ts`

```typescript
import { db } from '@lib/db';
import { brands, adsReports } from '@lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateAudienceStrategy } from '@lib/integrations-anthropic';
import { buildAudiencePrompt } from './prompt-builder';
import type { AudienceInput, AudienceOutput } from '@lib/api-zod/ads-strategy';

export async function executeAudienceModule(
  input: AudienceInput,
  userId: string
): Promise<AdsReportRecord> {
  const startTime = Date.now();
  
  // 1. Load brand with ads_context
  const brand = await db.query.brands.findFirst({
    where: eq(brands.id, input.brand_id),
  });
  if (!brand) throw new NotFoundError('Brand not found');
  
  // 2. Build prompt with brand context
  const prompt = buildAudiencePrompt(input, brand);
  
  // 3. Call Claude (with retry inside integration package)
  const result = await generateAudienceStrategy({
    prompt,
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 4000,
    responseFormat: 'json',
  });
  
  // 4. Validate output against Zod schema
  const validated = audienceOutputSchema.parse(result.content);
  
  // 5. Save to ads_reports
  const [report] = await db.insert(adsReports).values({
    brandId: input.brand_id,
    module: 'audience',
    input,
    output: validated,
    aiProvider: 'anthropic',
    aiModel: 'claude-haiku-4-5-20251001',
    tokensInput: result.usage.input_tokens,
    tokensOutput: result.usage.output_tokens,
    costEur: calculateCost(result.usage, 'haiku'),
    latencyMs: Date.now() - startTime,
    status: 'completed',
  }).returning();
  
  return report;
}

function calculateCost(usage: TokenUsage, model: 'haiku' | 'sonnet'): number {
  const rates = {
    haiku: { input: 0.0008, output: 0.004 },   // per 1k tokens, USD
    sonnet: { input: 0.003, output: 0.015 },
  };
  const usd = (usage.input_tokens * rates[model].input + 
               usage.output_tokens * rates[model].output) / 1000;
  return usd * 0.92; // USD → EUR approx
}
```

### 4.2 Handler: `routes/ads-strategy/audience.handler.ts`

```typescript
import { Router } from 'express';
import { audienceInputSchema } from '@lib/api-zod/ads-strategy';
import { executeAudienceModule } from '../../services/ads-strategy/audience.service';
import { requireAuth } from '../../middleware/auth';

export const audienceRouter = Router();

audienceRouter.post('/audience', requireAuth, async (req, res, next) => {
  try {
    const input = audienceInputSchema.parse(req.body);
    const report = await executeAudienceModule(input, req.session.userId!);
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});
```

### 4.3 Frontend: `features/strategy/ads/AudienceTab.tsx`

```tsx
import { useGenerateAudience } from '@lib/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { audienceInputSchema } from '@lib/api-zod/ads-strategy';

export function AudienceTab() {
  const mutation = useGenerateAudience();
  const form = useForm({ resolver: zodResolver(audienceInputSchema) });
  
  const onSubmit = (data: AudienceInput) => mutation.mutate(data);
  
  return (
    <div>
      <Form {...form}>
        {/* form fields with shadcn/ui */}
      </Form>
      {mutation.isPending && <LoadingState />}
      {mutation.isError && <ErrorState error={mutation.error} />}
      {mutation.data && <PersonaResults data={mutation.data.output} />}
    </div>
  );
}
```

---

## 5. Module 2 — Keyword Weight (Gemini)

### 5.1 Why Gemini Flash
- Cost: ~10x cheaper than Claude Haiku for similar quality on extraction tasks
- Fast: <5s response time
- Integration: `@google/genai` đã có sẵn trong `lib/integrations-google`

### 5.2 Service flow same as M1, but call Gemini

```typescript
// lib/integrations-google/src/index.ts (extend)
import { GoogleGenAI } from '@google/genai';

export async function generateKeywords(input: KeywordsServiceInput): Promise<KeywordsResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_KEY! });
  
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [{ text: input.prompt }],
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: keywordsOutputSchemaJSON, // converted from Zod to JSON Schema
      temperature: 0.7,
    },
  });
  
  return {
    content: JSON.parse(result.text),
    usage: {
      input_tokens: result.usageMetadata.promptTokenCount,
      output_tokens: result.usageMetadata.candidatesTokenCount,
    },
  };
}
```

---

## 6. Module 3 — Performance Reality (Claude Sonnet)

### 6.1 CSV processing pipeline

```typescript
// services/ads-strategy/csv-parser.ts
import { parse } from 'csv-parse/sync';

export interface NormalizedAdRow {
  source: 'meta' | 'google';
  campaign: string;
  ad_set_or_ad_group: string;
  ad_or_keyword: string;
  spend_eur: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  cpc: number;
  cpl: number;
}

export function parseAdsCSV(buffer: Buffer): NormalizedAdRow[] {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  
  // Detect format
  const headers = Object.keys(records[0] ?? {});
  if (headers.includes('Campaign name') && headers.includes('Ad set name')) {
    return records.map(r => normalizeMetaRow(r));
  }
  if (headers.includes('Campaign') && headers.includes('Ad group')) {
    return records.map(r => normalizeGoogleRow(r));
  }
  throw new Error('Unsupported CSV format. Expected Meta or Google Ads export.');
}

export function buildAggregateStats(rows: NormalizedAdRow[]): AggregateStats {
  // Compute totals + averages
}

export function selectTopAndBottom(
  rows: NormalizedAdRow[],
  metric: keyof NormalizedAdRow,
  count: number = 10
): { top: NormalizedAdRow[]; bottom: NormalizedAdRow[] } {
  const sorted = [...rows].sort((a, b) => Number(a[metric]) - Number(b[metric]));
  return {
    top: sorted.slice(-count).reverse(),
    bottom: sorted.slice(0, count),
  };
}
```

### 6.2 Service uses multipart upload

```typescript
// routes/ads-strategy/performance.handler.ts
import multer from 'multer';
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.post('/performance', requireAuth, upload.single('csv_file'), async (req, res, next) => {
  // ... parse CSV from req.file.buffer
  // ... call analyzePerformance from integrations-anthropic with Sonnet
});
```

---

## 7. Module 4 — Trend Pulse (Grok)

### 7.1 Why Grok
- Real-time data access (X/Twitter trends, news)
- Đã setup trong `lib/integrations-xai`
- Phù hợp với task "what's trending RIGHT NOW in [region]"

### 7.2 Output focuses on actionable trends

```typescript
interface TrendOutput {
  trends: Array<{
    topic: string;
    relevance_score: number;     // 1-10 cho brand
    momentum: 'rising' | 'peak' | 'declining';
    suggested_angle: string;     // Ý tưởng content cụ thể
    suggested_keywords: string[];
    estimated_window_days: number; // Còn bao lâu để capitalize
    sources: string[];
  }>;
  regional_signals: {
    bayern_specific: string[];
    germany_wide: string[];
  };
  risks_to_avoid: string[];      // Trends nên tránh (controversial)
}
```

---

## 8. Shared infrastructure

### 8.1 Repository pattern: `repositories/ads-reports.repo.ts`

```typescript
import { db } from '@lib/db';
import { adsReports } from '@lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export const adsReportsRepo = {
  async create(data: NewAdsReport) {
    const [report] = await db.insert(adsReports).values(data).returning();
    return report;
  },
  
  async findById(id: string) {
    return db.query.adsReports.findFirst({
      where: eq(adsReports.id, id),
      with: { brand: true },
    });
  },
  
  async list(params: ListParams) {
    const conditions = [];
    if (params.brand_id) conditions.push(eq(adsReports.brandId, params.brand_id));
    if (params.module) conditions.push(eq(adsReports.module, params.module));
    
    const [data, [{ count }]] = await Promise.all([
      db.select().from(adsReports)
        .where(and(...conditions))
        .orderBy(desc(adsReports.createdAt))
        .limit(params.limit)
        .offset(params.offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(adsReports)
        .where(and(...conditions))
    ]);
    
    return { data, total: count, has_more: params.offset + data.length < count };
  },
  
  async update(id: string, data: Partial<NewAdsReport>) {
    const [report] = await db.update(adsReports)
      .set(data)
      .where(eq(adsReports.id, id))
      .returning();
    return report;
  },
  
  async delete(id: string) {
    await db.delete(adsReports).where(eq(adsReports.id, id));
  },
  
  async getCostSummary(period: { from: Date; to: Date }) {
    // Aggregate cost grouped by ai_provider + module
  },
};
```

### 8.2 Error handling

Standard HTTP error codes:
- `400` — validation error (Zod failed)
- `401` — not authenticated
- `403` — not authorized
- `404` — brand or report not found
- `429` — AI provider rate limit
- `500` — AI provider error or server error
- `503` — AI provider timeout

Custom error classes in `lib/errors`:
```typescript
export class ValidationError extends Error { code = 400 }
export class NotFoundError extends Error { code = 404 }
export class AIProviderError extends Error { code = 502; provider: string }
export class RateLimitError extends Error { code = 429; retryAfter: number }
```

---

## 9. Performance targets

| Metric | Target | How to measure |
|---|---|---|
| M1 (Haiku) p95 latency | < 8s | log `latency_ms` in DB |
| M2 (Gemini Flash) p95 | < 5s | same |
| M3 (Sonnet) p95 | < 25s | same |
| M4 (Grok) p95 | < 10s | same |
| Frontend render after data | < 300ms | DevTools Performance |
| DB query for list reports | < 50ms | EXPLAIN ANALYZE |
| Cost per M1 call | < €0.005 | calculate from usage |
| Cost per M3 call | < €0.05 | same |

---

## 10. Security

- **API keys** chỉ trong env vars, never in code or logs
- **CSV uploads** parsed in-memory only, never written to disk
- **Cookie session** httpOnly + secure + sameSite=strict
- **CORS** strict whitelist (configured)
- **Rate limit** per session: max 100 AI calls / hour (use existing rate limit middleware nếu có)
- **SQL injection** prevented by Drizzle prepared queries
- **JSONB validation** — every JSONB write must pass Zod schema

---

**Tham khảo tiếp:** `PROMPTS.md` cho prompt templates, `INTEGRATION_GUIDE.md` cho cách extend integration packages.
