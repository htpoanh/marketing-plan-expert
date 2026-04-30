# DATA_SCHEMAS.md — TypeScript + Zod Schemas (v2)

> Tất cả schemas khai báo trong OpenAPI spec → Orval generate Zod → tái dùng frontend + backend.

---

## 1. Brand types (existing, extended)

### 1.1 Drizzle schema

```typescript
// lib/db/schema.ts (extension)
export const brands = pgTable('brands', {
  // ... existing columns
  
  // NEW
  adsContext: jsonb('ads_context').$type<BrandAdsContext>().default({}),
  serviceRadiusKm: integer('service_radius_km'),
  avgTicketSizeEur: decimal('avg_ticket_size_eur', { precision: 10, scale: 2 }),
  locationCity: varchar('location_city', { length: 100 }),
  locationRegion: varchar('location_region', { length: 100 }),
  locationCountry: varchar('location_country', { length: 2 }).default('DE'),
  locationCoordinates: jsonb('location_coordinates').$type<{ lat: number; lon: number }>(),
});
```

### 1.2 BrandAdsContext type

```typescript
export interface BrandAdsContext {
  unique_selling_points: string[];
  brand_voice: {
    tone: string;
    avoid: string[];
    prefer: string[];
    example_phrases: string[];
  };
  pain_points_solved: string[];
  common_objections: Array<{ 
    objection: string; 
    counter: string;
  }>;
  past_campaigns: {
    successful: Array<{ name: string; result: string; learning: string }>;
    failed: Array<{ name: string; reason: string }>;
  };
  seasonality: {
    high_months: number[];      // 1-12
    low_months: number[];
    special_events: string[];
  };
  competitors: Array<{
    name: string;
    location: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  primary_customer_persona: string;
  visual_identity: {
    primary_colors: string[];
    photography_style: string;
  };
  compliance_notes: string[];
  last_updated: string;
}
```

### 1.3 Zod schema

```typescript
// lib/api-zod/src/brand-ads-context.ts
import { z } from 'zod';

export const brandAdsContextSchema = z.object({
  unique_selling_points: z.array(z.string()).max(10),
  brand_voice: z.object({
    tone: z.string(),
    avoid: z.array(z.string()),
    prefer: z.array(z.string()),
    example_phrases: z.array(z.string()).max(20),
  }),
  pain_points_solved: z.array(z.string()).max(15),
  common_objections: z.array(z.object({
    objection: z.string(),
    counter: z.string(),
  })).max(10),
  past_campaigns: z.object({
    successful: z.array(z.object({
      name: z.string(),
      result: z.string(),
      learning: z.string(),
    })).max(20),
    failed: z.array(z.object({
      name: z.string(),
      reason: z.string(),
    })).max(20),
  }),
  seasonality: z.object({
    high_months: z.array(z.number().int().min(1).max(12)),
    low_months: z.array(z.number().int().min(1).max(12)),
    special_events: z.array(z.string()),
  }),
  competitors: z.array(z.object({
    name: z.string(),
    location: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  })).max(20),
  primary_customer_persona: z.string(),
  visual_identity: z.object({
    primary_colors: z.array(z.string()),
    photography_style: z.string(),
  }),
  compliance_notes: z.array(z.string()),
  last_updated: z.string().datetime(),
});

export type BrandAdsContext = z.infer<typeof brandAdsContextSchema>;
```

---

## 2. M1 — Audience Targeting

### 2.1 Input

```typescript
// lib/api-zod/src/ads-strategy/audience.ts
import { z } from 'zod';

export const audienceInputSchema = z.object({
  brand_id: z.string().uuid(),
  service: z.string().min(5).max(200),
  goal: z.enum(['booking', 'awareness', 'retention']),
  budget_eur_month: z.number().min(50).max(50000),
  avg_ticket_size_eur: z.number().min(1).max(1000),
  current_customer_notes: z.string().max(2000).optional(),
  competitors: z.array(z.string()).max(10).optional(),
  output_language: z.enum(['de', 'vi']),
});

export type AudienceInput = z.infer<typeof audienceInputSchema>;
```

### 2.2 Output

```typescript
const personaSchema = z.object({
  rank: z.number().int().min(1).max(5),
  name: z.string(),
  age: z.number().int().min(13).max(99),
  profession: z.string(),
  location_detail: z.string(),
  demographics: z.object({
    gender: z.enum(['male', 'female', 'diverse']),
    family_status: z.string(),
    income_bracket: z.string(),
    education: z.string().nullable(),
  }),
  psychographics: z.object({
    values: z.array(z.string()),
    aspirations: z.array(z.string()),
    fears: z.array(z.string()),
  }),
  online_behavior: z.object({
    platforms: z.array(z.string()),
    active_hours: z.string(),
    follows: z.array(z.string()),
    consumption_pattern: z.string(),
  }),
  pain_points: z.array(z.string()),
  buying_triggers: z.array(z.string()),
  budget_per_purchase: z.string(),
  estimated_audience_size: z.string().refine(
    (s) => /ESTIMATE|Schätzung/i.test(s),
    { message: 'Must contain ESTIMATE or Schätzung marker' }
  ),
});

const metaTargetingSchema = z.object({
  persona_rank: z.number().int().min(1).max(5),
  ad_set_name: z.string(),
  location: z.object({
    type: z.enum(['radius', 'city', 'region']),
    address: z.string(),
    radius_km: z.number().optional(),
  }),
  age_range: z.tuple([z.number().int(), z.number().int()]),
  gender: z.enum(['all', 'female', 'male']),
  interests: z.array(z.string()),
  behaviors: z.array(z.string()),
  lookalike_source: z.string().nullable(),
  advantage_plus_recommended: z.boolean(),
});

const googleTargetingSchema = z.object({
  persona_rank: z.number().int().min(1).max(5),
  campaign_type: z.enum(['search', 'display', 'pmax', 'demand_gen']),
  keyword_themes: z.array(z.string()),
  demographic_filters: z.object({
    age_ranges: z.array(z.string()),
    household_income: z.string().nullable(),
    parental_status: z.string().nullable(),
  }),
});

export const audienceOutputSchema = z.object({
  personas: z.array(personaSchema).min(3).max(5),
  meta_targeting: z.array(metaTargetingSchema),
  google_targeting: z.array(googleTargetingSchema),
  negative_audiences: z.array(z.object({
    exclude: z.string(),
    reason: z.string(),
  })),
  budget_split: z.array(z.object({
    persona_rank: z.number().int(),
    percentage: z.number().min(0).max(100),
    amount_eur: z.number(),
    reason: z.string(),
  })).refine(
    (splits) => Math.abs(splits.reduce((s, x) => s + x.percentage, 0) - 100) <= 1,
    { message: 'budget_split percentages must sum to 100 (±1)' }
  ),
  next_steps: z.array(z.string()).min(3).max(5),
});

export type AudienceOutput = z.infer<typeof audienceOutputSchema>;
```

---

## 3. M2 — Keyword Weight

### 3.1 Input

```typescript
export const keywordsInputSchema = z.object({
  brand_id: z.string().uuid(),
  service: z.string().min(5).max(200),
  location_radius_km: z.number().int().min(1).max(200),
  competitors: z.array(z.string()).max(10).optional(),
  pain_points: z.string().max(1000).optional(),
  seasonality: z.enum([
    'summer', 'winter', 'wedding-season', 
    'back-to-school', 'holiday', 'none'
  ]).optional(),
  output_language: z.enum(['de', 'vi']),
});

export type KeywordsInput = z.infer<typeof keywordsInputSchema>;
```

### 3.2 Output

```typescript
const keywordSchema = z.object({
  text: z.string(),
  intent_score: z.number().int().min(1).max(10),
  estimated_volume: z.enum(['Low', 'Medium', 'High']),
  estimated_cpc_eur: z.string().refine(
    (s) => /ESTIMATE|Schätzung/i.test(s),
    { message: 'Must contain ESTIMATE marker' }
  ),
  match_type_recommended: z.enum(['exact', 'phrase', 'broad']),
  use_case_note: z.string(),
});

export const keywordsOutputSchema = z.object({
  money_keywords: z.array(keywordSchema).min(8).max(15),
  discovery_keywords: z.array(keywordSchema).min(8).max(15),
  defensive_keywords: z.array(keywordSchema).max(15),
  long_tail_booking: z.array(keywordSchema).min(8).max(15),
  warnings: z.array(z.string()),
  verification_checklist: z.array(z.string()).refine(
    (items) => items.some(i => /Google Keyword Planner/i.test(i)),
    { message: 'Must include Google Keyword Planner verification' }
  ),
});

export type KeywordsOutput = z.infer<typeof keywordsOutputSchema>;
```

---

## 4. M3 — Performance Reality

### 4.1 Input (multipart form)

Backend receives:
- `brand_id`: UUID
- `csv_file`: File (max 10MB)
- `period_days`: 7|14|30|90
- `goal_metric`: 'cpl'|'roas'|'cpc'|'ctr'|'cpa'
- `goal_value`: number
- `avg_ticket_size_eur`: number
- `external_context`: string (optional)
- `output_language`: 'de'|'vi'

```typescript
export const performanceInputSchema = z.object({
  brand_id: z.string().uuid(),
  period_days: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90)]),
  goal_metric: z.enum(['cpl', 'roas', 'cpc', 'ctr', 'cpa']),
  goal_value: z.number(),
  avg_ticket_size_eur: z.number().min(1).max(10000),
  external_context: z.string().max(2000).optional(),
  output_language: z.enum(['de', 'vi']),
});

export type PerformanceInput = z.infer<typeof performanceInputSchema>;
```

### 4.2 Internal CSV row schema

```typescript
export const adRowSchema = z.object({
  source: z.enum(['meta', 'google']),
  campaign: z.string(),
  ad_set_or_ad_group: z.string(),
  ad_or_keyword: z.string(),
  spend_eur: z.number().min(0),
  impressions: z.number().int().min(0),
  clicks: z.number().int().min(0),
  results: z.number().min(0),
  // Derived (computed in csv-parser):
  ctr: z.number().min(0).max(1),
  cpc: z.number().min(0),
  cpl_or_cpa: z.number().min(0),
  roas: z.number().min(0).optional(),
});

export type AdRow = z.infer<typeof adRowSchema>;
```

### 4.3 Output

```typescript
export const performanceOutputSchema = z.object({
  executive_summary: z.string().min(50).max(800),
  current_state: z.object({
    spend_eur: z.number(),
    results: z.number(),
    actual_metric_value: z.number(),
    goal_metric_value: z.number(),
    vs_goal: z.enum(['above', 'on_track', 'below']),
    headline_finding: z.string(),
  }),
  whats_working: z.array(z.object({
    pattern: z.string(),
    evidence: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    leverage_action: z.string(),
  })).min(3),
  whats_wasting: z.array(z.object({
    what: z.string(),
    why: z.string(),
    spent_eur: z.number(),
    results: z.number(),
    action: z.enum(['pause', 'reduce_budget', 'change_creative', 'change_audience']),
    estimated_savings_eur: z.number(),
  })),
  hypotheses: z.array(z.object({
    id: z.string().regex(/^H[1-3]$/),
    statement: z.string(),
    test_design: z.object({
      variant_a: z.string(),
      variant_b: z.string(),
    }),
    sample_size_needed: z.string(),
    expected_outcome: z.string(),
    decision_criteria: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })).length(3),
  budget_reallocation: z.array(z.object({
    from: z.string(),
    to: z.string(),
    amount_eur: z.number(),
    reason: z.string(),
  })),
  risks: z.array(z.string()),
  next_review_date_recommended: z.string(),
});

export type PerformanceOutput = z.infer<typeof performanceOutputSchema>;
```

---

## 5. M4 — Trend Pulse

### 5.1 Input

```typescript
export const trendInputSchema = z.object({
  brand_id: z.string().uuid(),
  industry_keywords: z.array(z.string()).max(10).optional(),
  region_focus: z.enum(['city', 'region', 'germany']).default('region'),
  output_language: z.enum(['de', 'vi']),
});

export type TrendInput = z.infer<typeof trendInputSchema>;
```

### 5.2 Output

```typescript
export const trendOutputSchema = z.object({
  trends: z.array(z.object({
    topic: z.string(),
    relevance_score: z.number().int().min(1).max(10),
    momentum: z.enum(['rising', 'peak', 'declining']),
    suggested_angle: z.string(),
    suggested_keywords: z.array(z.string()),
    estimated_window_days: z.number().int().min(1).max(90),
    sources: z.array(z.string()),
  })).min(3).max(10),
  regional_signals: z.object({
    bayern_specific: z.array(z.string()),
    germany_wide: z.array(z.string()),
  }),
  risks_to_avoid: z.array(z.string()),
});

export type TrendOutput = z.infer<typeof trendOutputSchema>;
```

---

## 6. AdsReport (DB record)

### 6.1 Drizzle-zod auto-generated

```typescript
// lib/db/schema.ts
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const adsReportInsertSchema = createInsertSchema(adsReports);
export const adsReportSelectSchema = createSelectSchema(adsReports);

export type AdsReport = z.infer<typeof adsReportSelectSchema>;
export type NewAdsReport = z.infer<typeof adsReportInsertSchema>;
```

### 6.2 API response wrapper

```typescript
export const adsReportResponseSchema = adsReportSelectSchema.extend({
  brand: z.object({
    id: z.string().uuid(),
    name: z.string(),
    locationCity: z.string().nullable(),
  }).optional(),
});

export const listAdsReportsResponseSchema = z.object({
  data: z.array(adsReportResponseSchema),
  total: z.number().int(),
  has_more: z.boolean(),
});
```

---

## 7. Error response schemas

```typescript
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum([
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'AI_PROVIDER_ERROR',
      'AI_TIMEOUT',
      'AI_RATE_LIMIT',
      'CSV_PARSE_ERROR',
      'TOKEN_LIMIT_EXCEEDED',
      'INTERNAL_ERROR',
    ]),
    message: z.string(),
    details: z.unknown().optional(),
    retryable: z.boolean(),
  }),
});
```

---

## 8. Validation flow

### 8.1 Backend (per request)

```typescript
// 1. Parse Zod from API spec generated
const input = audienceInputSchema.parse(req.body);

// 2. Service validates output from AI
const aiResult = await generateAudienceStrategy({...});
const validatedOutput = audienceOutputSchema.parse(aiResult.content);
//                       ^^^ throws ZodError if AI returned malformed

// 3. Save to DB (Drizzle types match)
await db.insert(adsReports).values({
  brandId: input.brand_id,
  module: 'audience',
  input,
  output: validatedOutput,  // typed as AudienceOutput
  // ...
});
```

### 8.2 Frontend (per mutation)

```typescript
// React Hook Form + Zod resolver
const form = useForm<AudienceInput>({
  resolver: zodResolver(audienceInputSchema),
  defaultValues: { /* ... */ },
});

// Generated React Query hook handles response validation automatically
const mutation = useGenerateAudience();
mutation.mutate(form.getValues());

// mutation.data is fully typed as AudienceOutput
```

---

## 9. Schema versioning

When schema changes:

1. Bump version in OpenAPI: `info.version: 1.1.0`
2. Add migration note in `lib/api-spec/CHANGELOG.md`
3. Run codegen: `pnpm codegen`
4. Test all consumers compile: `pnpm typecheck`
5. Add DB migration if new fields: `pnpm db:generate`

Breaking changes (require major version bump):
- Removing fields
- Changing field types
- Adding required fields without default

Non-breaking:
- Adding optional fields
- Adding new endpoints
- Loosening constraints
