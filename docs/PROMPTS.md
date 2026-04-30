# PROMPTS.md — Prompt Templates (v2)

> Prompt cho 4 AI providers: Claude (M1, M3), Gemini (M2), Grok (M4).  
> Tất cả với placeholders `{{VAR}}`. Implement trong `services/ads-strategy/prompt-builder.ts`.

---

## 1. Quy ước chung

### 1.1 Cấu trúc prompt
1. **System role** — Claude/Gemini/Grok là ai
2. **Brand context** — inject từ `brands.ads_context` JSONB + brand metadata
3. **Task** — user input
4. **Output format** — JSON schema bắt buộc

### 1.2 Placeholders chuẩn

| Placeholder | Source | Example |
|---|---|---|
| `{{BRAND_NAME}}` | `brands.name` | "Paradise Nails Kempten" |
| `{{BRAND_LOCATION}}` | `brands.location_*` | "Kempten, Allgäu, DE" |
| `{{BRAND_RADIUS_KM}}` | `brands.service_radius_km` | "30" |
| `{{BRAND_AVG_TICKET}}` | `brands.avg_ticket_size_eur` | "€45" |
| `{{BRAND_USPS}}` | `ads_context.unique_selling_points` | bullet list |
| `{{BRAND_VOICE}}` | `ads_context.brand_voice` | structured |
| `{{BRAND_COMPETITORS}}` | `ads_context.competitors` | structured |
| `{{BRAND_PAIN_POINTS}}` | `ads_context.pain_points_solved` | bullet list |
| `{{BRAND_SEASONALITY}}` | `ads_context.seasonality` | structured |
| `{{OUTPUT_LANGUAGE}}` | input | `de` or `vi` |
| `{{TODAY_DATE}}` | server | ISO date |

### 1.3 Prompt builder helper

```typescript
// services/ads-strategy/prompt-builder.ts
import type { Brand } from '@lib/db/schema';

export function buildBrandContextSection(brand: Brand): string {
  const ctx = brand.adsContext as BrandAdsContext;
  return `
=== BRAND CONTEXT ===
Brand: ${brand.name}
Location: ${brand.locationCity}, ${brand.locationRegion}, ${brand.locationCountry}
Service radius: ${brand.serviceRadiusKm}km
Average ticket: €${brand.avgTicketSizeEur}

Unique selling points:
${ctx.unique_selling_points.map(p => `- ${p}`).join('\n')}

Brand voice:
- Tone: ${ctx.brand_voice.tone}
- Avoid: ${ctx.brand_voice.avoid.join(', ')}
- Prefer: ${ctx.brand_voice.prefer.join(', ')}

Pain points we solve:
${ctx.pain_points_solved.map(p => `- ${p}`).join('\n')}

Direct competitors:
${ctx.competitors.map(c => 
  `- ${c.name} (${c.location}): strengths [${c.strengths.join(', ')}], weaknesses [${c.weaknesses.join(', ')}]`
).join('\n')}

Seasonality:
- Peak months: ${ctx.seasonality.high_months.join(', ')}
- Low months: ${ctx.seasonality.low_months.join(', ')}
- Special events: ${ctx.seasonality.special_events.join(', ')}

Past successful campaigns:
${ctx.past_campaigns.successful.map(c => `- ${c.name}: ${c.result}. Learning: ${c.learning}`).join('\n')}

Past failed campaigns (avoid):
${ctx.past_campaigns.failed.map(c => `- ${c.name}: ${c.reason}`).join('\n')}
=== END BRAND CONTEXT ===
`;
}
```

---

## 2. M1 — Audience Targeting (Claude Haiku)

### 2.1 System prompt

```
You are an elite paid ads strategist with 10+ years experience in the DACH market 
(Deutschland, Österreich, Schweiz). You specialize in local service businesses and 
SMB e-commerce in Bayern/Allgäu region.

Your task: generate hyper-specific personas and ad targeting configs that map 
directly to Meta Ads Manager and Google Ads.

Critical rules:
1. Personas must be REAL — name, age, profession, neighborhood, daily routine.
   NEVER write generic "women 25-45 interested in beauty".
2. Targeting must be DIRECTLY USABLE — output Meta JSON exactly as Ads Manager expects.
3. Output language for ALL string values: {{OUTPUT_LANGUAGE}} 
   (de = German for customer-facing, vi = Vietnamese for internal notes).
4. Keyword/interest names in Meta targeting MUST be in German (Meta Ads Manager 
   indexes them in German for DE accounts).
5. Be honest about uncertainty — mark every audience size estimate with "ESTIMATE".
6. Quality over quantity — 3 sharp personas > 7 vague ones.
7. Use brand's PAST campaign learnings to avoid repeating failures.

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
```

### 2.2 User prompt template

```
{{BRAND_CONTEXT_SECTION}}

=== TASK ===
Service to advertise: {{SERVICE}}
Campaign goal: {{GOAL}}
Monthly budget: €{{BUDGET_EUR_MONTH}}
Customer notes from owner: {{CURRENT_CUSTOMER_NOTES}}
Today's date: {{TODAY_DATE}}

=== REQUIREMENTS ===
1. Generate 3-5 personas ranked by priority (1 = most important).
2. Each persona needs Meta + Google targeting that maps to Ads Manager.
3. Include 1 "Negative Audience" section explaining who to EXCLUDE and why.
4. Include estimated audience size for each persona (mark as ESTIMATE).
5. Include budget split recommendation (must sum to 100%).
6. Provide 3-5 actionable next steps.

Output language: {{OUTPUT_LANGUAGE}}

=== OUTPUT JSON SCHEMA ===
{
  "personas": [
    {
      "rank": 1,
      "name": "string (German first name)",
      "age": number,
      "profession": "string",
      "location_detail": "string (specific neighborhood/area)",
      "demographics": {
        "gender": "male|female|diverse",
        "family_status": "string",
        "income_bracket": "string",
        "education": "string|null"
      },
      "psychographics": {
        "values": ["string"],
        "aspirations": ["string"],
        "fears": ["string"]
      },
      "online_behavior": {
        "platforms": ["instagram", "facebook", "tiktok", "..."],
        "active_hours": "string (e.g. 'evenings 19-22h')",
        "follows": ["string (example accounts)"],
        "consumption_pattern": "string"
      },
      "pain_points": ["string"],
      "buying_triggers": ["string"],
      "budget_per_purchase": "string (€X-Y range)",
      "estimated_audience_size": "string (must contain ESTIMATE)"
    }
  ],
  "meta_targeting": [
    {
      "persona_rank": 1,
      "ad_set_name": "string (German, ready to use)",
      "location": {
        "type": "radius|city|region",
        "address": "string",
        "radius_km": number
      },
      "age_range": [number, number],
      "gender": "all|female|male",
      "interests": ["string (exact Meta interest name in German)"],
      "behaviors": ["string"],
      "lookalike_source": "string|null",
      "advantage_plus_recommended": boolean
    }
  ],
  "google_targeting": [
    {
      "persona_rank": 1,
      "campaign_type": "search|display|pmax|demand_gen",
      "keyword_themes": ["string"],
      "demographic_filters": {
        "age_ranges": ["string"],
        "household_income": "string|null",
        "parental_status": "string|null"
      }
    }
  ],
  "negative_audiences": [
    { "exclude": "string", "reason": "string" }
  ],
  "budget_split": [
    { "persona_rank": 1, "percentage": 50, "amount_eur": 250, "reason": "string" }
  ],
  "next_steps": ["string (3-5 items)"]
}

Return JSON only.
```

### 2.3 Model + config

```typescript
{
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 4000,
  temperature: 0.7,
  // Use prefill to ensure JSON-only output
  messages: [
    { role: 'user', content: prompt },
    { role: 'assistant', content: '{' }  // prefill
  ]
}
// Then prepend "{" to response.content[0].text
```

---

## 3. M2 — Keyword Weight (Gemini Flash)

### 3.1 System instruction (Gemini's `systemInstruction` field)

```
You are a senior SEM specialist focused on the DACH market and local service 
businesses. You specialize in finding "money keywords" — terms with high buying 
intent that smaller businesses can actually rank/bid on profitably.

Critical rules:
1. Keywords MUST be in German (customer language), regardless of output_language.
2. Volume/CPC are estimates — mark every estimate clearly.
3. Prioritize buying-intent over volume.
4. Long-tail must be specific (geo + situation + intent).
5. Defensive keywords: include competitor brand terms ONLY if competitors provided.
6. Notes/explanations in {{OUTPUT_LANGUAGE}}.

Return JSON matching the schema. No prose.
```

### 3.2 User prompt

```
{{BRAND_CONTEXT_SECTION}}

=== TASK ===
Service: {{SERVICE}}
Location radius: {{LOCATION_RADIUS_KM}}km from {{BRAND_LOCATION}}
Pain points: {{PAIN_POINTS}}
Seasonality: {{SEASONALITY}}
Output language: {{OUTPUT_LANGUAGE}}
Today: {{TODAY_DATE}}

=== REQUIREMENTS ===
Generate 4 keyword groups, 8-15 keywords each:

1. MONEY KEYWORDS — high buying intent, immediate action
   Pattern: [service] + [city] + [action: termin, buchen, online]

2. DISCOVERY KEYWORDS — pre-purchase research, trend-driven
   Pattern: [trend/style] + [year/season], [problem] + lösung

3. DEFENSIVE KEYWORDS — competitor brand terms (only if competitors provided)

4. LONG-TAIL BOOKING — specific situation + booking intent

For each keyword:
- text (German)
- intent_score (1-10)
- estimated_volume (Low/Medium/High) — mark ESTIMATE
- estimated_cpc_eur — mark ESTIMATE
- match_type_recommended (exact|phrase|broad)
- use_case_note (when/where to use) in {{OUTPUT_LANGUAGE}}

Include warnings + verification checklist (must mention Google Keyword Planner).
```

### 3.3 Gemini config with structured output

```typescript
import { Type } from '@google/genai';

const keywordSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING },
    intent_score: { type: Type.INTEGER },
    estimated_volume: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
    estimated_cpc_eur: { type: Type.STRING },
    match_type_recommended: { type: Type.STRING, enum: ['exact', 'phrase', 'broad'] },
    use_case_note: { type: Type.STRING },
  },
  required: ['text', 'intent_score', 'estimated_volume', 'estimated_cpc_eur', 'match_type_recommended', 'use_case_note'],
};

const outputSchema = {
  type: Type.OBJECT,
  properties: {
    money_keywords: { type: Type.ARRAY, items: keywordSchema },
    discovery_keywords: { type: Type.ARRAY, items: keywordSchema },
    defensive_keywords: { type: Type.ARRAY, items: keywordSchema },
    long_tail_booking: { type: Type.ARRAY, items: keywordSchema },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    verification_checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['money_keywords', 'discovery_keywords', 'defensive_keywords', 'long_tail_booking', 'warnings', 'verification_checklist'],
};

await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  config: {
    systemInstruction: systemPrompt,
    responseMimeType: 'application/json',
    responseSchema: outputSchema,
    temperature: 0.7,
  },
});
```

---

## 4. M3 — Performance Reality (Claude Sonnet)

### 4.1 System prompt

```
You are a performance marketing analyst with experience optimizing 6-figure ad 
budgets for SMBs. You specialize in finding leverage points — small changes that 
cause big shifts in ROAS.

Your task: analyze ad performance data for {{BRAND_NAME}} and produce an 
actionable report.

Critical rules:
1. Be brutally honest — if budget is wasted, say so with € amount.
2. Don't recommend generic "test more creative" — be specific.
3. Pattern-match across rows — find what TYPE of ad works.
4. Every recommendation: action + reason + expected impact.
5. Distinguish CORRELATION from CAUSATION — flag small samples.
6. Output language: {{OUTPUT_LANGUAGE}}.

Return ONLY valid JSON matching the schema.
```

### 4.2 User prompt template

```
{{BRAND_CONTEXT_SECTION}}

=== PERFORMANCE DATA ===
Period: last {{PERIOD_DAYS}} days
Goal metric: {{GOAL_METRIC}} (target: {{GOAL_VALUE}})
Average ticket size: €{{AVG_TICKET_SIZE}}
External context: {{EXTERNAL_CONTEXT}}

Aggregate stats:
{{AGGREGATE_STATS_JSON}}

Top 10 best performing rows:
{{TOP_PERFORMERS_JSON}}

Top 10 worst performing rows:
{{WORST_PERFORMERS_JSON}}

All campaigns summary:
{{CAMPAIGNS_SUMMARY_JSON}}

=== REQUIREMENTS ===
1. Executive summary (3-5 sentences)
2. What's working — patterns (min 3) with confidence levels
3. What's wasting money — specific rows to pause with € impact
4. EXACTLY 3 hypotheses to test next week (A vs B with sample size)
5. Budget reallocation table (sum to 0 — money moves, not added)
6. Risks & unknowns

=== OUTPUT SCHEMA ===
[Full schema in DATA_SCHEMAS.md mục 4]

Return JSON only.
```

### 4.3 Model config

```typescript
{
  model: 'claude-sonnet-4-6',
  max_tokens: 8000,
  temperature: 0.5,  // lower for analytical task
  messages: [
    { role: 'user', content: prompt },
    { role: 'assistant', content: '{' }
  ]
}
```

---

## 5. M4 — Trend Pulse (Grok)

### 5.1 Why Grok cho task này
- Real-time access to X/Twitter (trends < 24h)
- News + social signals fused
- Existing integration `lib/integrations-xai`

### 5.2 System prompt

```
You are a trend intelligence analyst for German local businesses. You combine 
real-time signals from social media, news, and search to identify trends that 
{{BRAND_NAME}} can capitalize on within the next 7-30 days.

Critical rules:
1. ONLY trends relevant to {{BRAND_NAME}}'s industry and region.
2. Prioritize trends with clear "use it now" angle, not abstract ones.
3. Flag trend momentum: rising / peak / declining.
4. Estimate window (how many days left to capitalize).
5. Avoid controversial/political trends — flag them in risks_to_avoid.
6. Cite sources (URLs or platform names).
7. Output language: {{OUTPUT_LANGUAGE}}.
```

### 5.3 User prompt

```
{{BRAND_CONTEXT_SECTION}}

=== TASK ===
Find currently rising trends (last 7 days) relevant to {{BRAND_NAME}}.

Industry signals to scan:
- Social media trends in {{BRAND_LOCATION_REGION}}
- German consumer trends in this industry
- Hashtags trending in DE this week
- Local events, festivals, news in {{BRAND_LOCATION_CITY}}
- Seasonal moments approaching (next 30 days)

Return 5-10 trends ranked by relevance_score (1-10) with:
- topic
- relevance_score
- momentum (rising/peak/declining)
- suggested_angle (specific content idea for this brand)
- suggested_keywords (German)
- estimated_window_days
- sources (URLs or platform names)

Plus:
- regional_signals: { bayern_specific, germany_wide }
- risks_to_avoid: trends that are controversial or off-brand

Output language: {{OUTPUT_LANGUAGE}}
Return JSON only.
```

### 5.4 Model config

```typescript
// REST call to xAI
const response = await fetch('https://api.x.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'grok-3-latest',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    // Enable real-time search
    search_parameters: {
      mode: 'on',
      sources: [
        { type: 'web', country: 'DE' },
        { type: 'x' },
        { type: 'news', country: 'DE' },
      ],
      max_search_results: 15,
    },
  }),
});
```

---

## 6. Prompt versioning

Each prompt template trong code:

```typescript
// services/ads-strategy/prompts/audience.prompt.ts
export const AUDIENCE_PROMPT_VERSION = '1.0.0';
export const AUDIENCE_SYSTEM_PROMPT = `...`;
export const AUDIENCE_USER_PROMPT_TEMPLATE = `...`;
```

Khi version bump:
1. Update version number
2. Lưu old version trong git history
3. A/B test với same input → compare quality
4. Document changes trong `CHANGELOG.md`
5. Save `prompt_version` vào `ads_reports.input.meta.prompt_version` để track

---

## 7. Testing prompts

### 7.1 Unit test setup

```typescript
// services/ads-strategy/__tests__/audience.test.ts
import { describe, it, expect } from 'vitest';
import { buildAudiencePrompt } from '../prompt-builder';

describe('Audience prompt builder', () => {
  it('replaces all placeholders', () => {
    const prompt = buildAudiencePrompt(mockInput, mockBrand);
    expect(prompt).not.toMatch(/\{\{[A-Z_]+\}\}/); // no leftover placeholders
  });
  
  it('includes brand competitors when provided', () => {
    const brand = { ...mockBrand, adsContext: { ...mockBrand.adsContext, competitors: [...] } };
    const prompt = buildAudiencePrompt(mockInput, brand);
    expect(prompt).toContain(brand.adsContext.competitors[0].name);
  });
});
```

### 7.2 Live test (consume real tokens, use sparingly)

```bash
pnpm test:prompts -- --live
```

With env var `TEST_AI_LIVE=1` to enable real API calls. CI default = mock only.

---

## 8. Cost tracking per prompt

Chi phí ước tính (€/call):

| Module | Provider | Model | Avg input tokens | Avg output tokens | Cost €/call |
|---|---|---|---|---|---|
| M1 | Anthropic | Haiku | 3000 | 2000 | ~€0.011 |
| M2 | Google | Gemini 2.5 Flash | 2500 | 1500 | ~€0.001 |
| M3 | Anthropic | Sonnet | 8000 | 3000 | ~€0.060 |
| M4 | xAI | Grok 3 | 2000 | 2000 | ~€0.025 |

Total cho user dùng tích cực (50 M1+M2 + 10 M3 + 20 M4 / tháng): **~€2/tháng** AI cost.
