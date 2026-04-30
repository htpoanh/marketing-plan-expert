# INTEGRATION_GUIDE.md — Extending AI Integration Packages

> Hướng dẫn extend `lib/integrations-anthropic`, `lib/integrations-google`, `lib/integrations-xai` để support 4 module mới mà không phá existing code.

---

## 1. Pattern hiện tại (cần audit trước)

Trước khi extend, Claude Code phải đọc các file:

```bash
lib/integrations-anthropic/src/index.ts        # exports
lib/integrations-anthropic/src/client.ts       # SDK wrapper
lib/integrations-anthropic/package.json        # dependencies
lib/integrations-google/src/index.ts
lib/integrations-google/src/client.ts
lib/integrations-xai/src/index.ts              # might be REST-based
```

Document trong AUDIT_REPORT.md:
- Có `client` factory chưa, hay từng function tự khởi tạo
- Error handling pattern (custom error class? throw plain Error?)
- Retry logic đã có chưa
- Token tracking đã có chưa
- Logging pattern

---

## 2. Extend `integrations-anthropic`

### 2.1 Existing structure (giả định)

```
lib/integrations-anthropic/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts           # public exports
    ├── client.ts          # Anthropic SDK client factory
    └── (existing functions for review reply, refinement)
```

### 2.2 Files mới cần thêm

```
lib/integrations-anthropic/src/
├── ads-strategy/
│   ├── index.ts                    # exports
│   ├── audience.ts                 # generateAudienceStrategy()
│   ├── performance.ts              # analyzePerformance()
│   ├── types.ts                    # input/output types
│   └── __tests__/
│       ├── audience.test.ts
│       └── performance.test.ts
```

### 2.3 Implementation example: `ads-strategy/audience.ts`

```typescript
import { getAnthropicClient } from '../client';
import type { 
  AudienceServiceInput, 
  AudienceServiceResult 
} from './types';
import { withRetry } from '../shared/retry';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4000;

export async function generateAudienceStrategy(
  input: AudienceServiceInput
): Promise<AudienceServiceResult> {
  const client = getAnthropicClient();
  
  const response = await withRetry(
    async () => {
      return client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
        system: input.systemPrompt,
        messages: [
          { role: 'user', content: input.userPrompt },
          { role: 'assistant', content: '{' }, // prefill for JSON-only
        ],
      });
    },
    { 
      maxAttempts: 3, 
      shouldRetry: (err) => isRetryableError(err),
      backoffMs: [1000, 3000, 8000],
    }
  );
  
  // Extract JSON from prefilled response
  const text = response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';
  const jsonText = '{' + text;
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new MalformedResponseError(
      'Anthropic returned invalid JSON',
      { rawResponse: jsonText, originalError: err }
    );
  }
  
  return {
    content: parsed,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
    model: MODEL,
    stop_reason: response.stop_reason,
  };
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('rate limit') 
      || msg.includes('timeout')
      || msg.includes('overloaded')
      || msg.includes('503');
  }
  return false;
}
```

### 2.4 `ads-strategy/types.ts`

```typescript
export interface AudienceServiceInput {
  systemPrompt: string;
  userPrompt: string;
  brandId: string;  // for logging
}

export interface AudienceServiceResult {
  content: unknown;  // raw JSON, validated by caller using Zod
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
  stop_reason: string | null;
}

// Same shape for Performance
export interface PerformanceServiceInput {
  systemPrompt: string;
  userPrompt: string;
  brandId: string;
}

export interface PerformanceServiceResult extends AudienceServiceResult {
  // identical for now; can diverge later
}
```

### 2.5 `ads-strategy/index.ts`

```typescript
export { generateAudienceStrategy } from './audience';
export { analyzePerformance } from './performance';
export type * from './types';
```

### 2.6 Update root `lib/integrations-anthropic/src/index.ts`

```typescript
// Existing exports
export * from './reviews-reply';
export * from './content-refinement';
// ... etc

// NEW
export * as adsStrategy from './ads-strategy';
```

Usage in service layer:

```typescript
import { adsStrategy } from '@lib/integrations-anthropic';

const result = await adsStrategy.generateAudienceStrategy({...});
```

---

## 3. Extend `integrations-google` (Gemini)

### 3.1 Files mới

```
lib/integrations-google/src/
├── ads-strategy/
│   ├── index.ts
│   ├── keywords.ts             # generateKeywords()
│   ├── types.ts
│   └── __tests__/
```

### 3.2 Implementation: `keywords.ts`

```typescript
import { getGenAIClient } from '../client';
import { Type } from '@google/genai';
import type { KeywordsServiceInput, KeywordsServiceResult } from './types';
import { withRetry } from '../shared/retry';

const MODEL = 'gemini-2.5-flash';

// JSON Schema cho structured output
const KEYWORDS_OUTPUT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    money_keywords: {
      type: Type.ARRAY,
      items: {
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
      },
    },
    discovery_keywords: { /* same shape */ },
    defensive_keywords: { /* same shape */ },
    long_tail_booking: { /* same shape */ },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    verification_checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'money_keywords', 'discovery_keywords', 'defensive_keywords', 
    'long_tail_booking', 'warnings', 'verification_checklist',
  ],
};

export async function generateKeywords(
  input: KeywordsServiceInput
): Promise<KeywordsServiceResult> {
  const ai = getGenAIClient();
  
  const response = await withRetry(
    async () => {
      return ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
        config: {
          systemInstruction: input.systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: KEYWORDS_OUTPUT_SCHEMA,
          temperature: 0.7,
        },
      });
    },
    { maxAttempts: 3 }
  );
  
  const text = response.text;
  if (!text) {
    throw new EmptyResponseError('Gemini returned empty response');
  }
  
  const parsed = JSON.parse(text);
  
  return {
    content: parsed,
    usage: {
      input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    },
    model: MODEL,
  };
}
```

---

## 4. Extend `integrations-xai` (Grok)

### 4.1 Note
xAI uses REST API (no official SDK as of 2026-04). Existing `integrations-xai` likely already has `fetch` wrapper.

### 4.2 Files mới

```
lib/integrations-xai/src/
├── ads-strategy/
│   ├── index.ts
│   ├── trend.ts                # getTrendPulse()
│   ├── types.ts
│   └── __tests__/
```

### 4.3 Implementation: `trend.ts`

```typescript
import { fetchXAI } from '../client';
import type { TrendServiceInput, TrendServiceResult } from './types';
import { withRetry } from '../shared/retry';

const MODEL = 'grok-3-latest';

export async function getTrendPulse(
  input: TrendServiceInput
): Promise<TrendServiceResult> {
  const response = await withRetry(
    async () => {
      return fetchXAI('/v1/chat/completions', {
        method: 'POST',
        body: {
          model: MODEL,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          search_parameters: {
            mode: 'on',
            sources: [
              { type: 'web', country: 'DE' },
              { type: 'x' },
              { type: 'news', country: 'DE' },
            ],
            max_search_results: 15,
            return_citations: true,
          },
        },
      });
    },
    { maxAttempts: 2, backoffMs: [2000, 5000] }  // Grok with search is slow
  );
  
  const content = response.choices[0]?.message?.content;
  if (!content) throw new EmptyResponseError('Grok empty response');
  
  const parsed = JSON.parse(content);
  
  return {
    content: parsed,
    usage: {
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0,
    },
    model: MODEL,
    citations: response.citations ?? [],
  };
}
```

---

## 5. Shared retry + error utilities

Tạo `lib/integrations-shared/` nếu chưa có (hoặc reuse từ existing).

### 5.1 `withRetry` helper

```typescript
// lib/integrations-shared/src/retry.ts
export interface RetryOptions {
  maxAttempts?: number;
  backoffMs?: number[];
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    backoffMs = [1000, 3000, 8000],
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;
  
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      
      if (attempt === maxAttempts || !shouldRetry(err)) {
        throw err;
      }
      
      onRetry?.(attempt, err);
      
      const delay = backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1];
      await sleep(delay);
    }
  }
  
  throw lastError;
}

function defaultShouldRetry(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('rate limit')
      || msg.includes('timeout')
      || msg.includes('503')
      || msg.includes('502')
      || msg.includes('overloaded');
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 5.2 Custom error classes

```typescript
// lib/integrations-shared/src/errors.ts
export class AIProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class MalformedResponseError extends AIProviderError {
  constructor(message: string, details?: unknown) {
    super(message, 'unknown', details);
    this.name = 'MalformedResponseError';
  }
}

export class EmptyResponseError extends AIProviderError {
  constructor(message: string) {
    super(message, 'unknown');
    this.name = 'EmptyResponseError';
  }
}

export class RateLimitError extends AIProviderError {
  constructor(public retryAfter: number, provider: string) {
    super(`Rate limit exceeded. Retry after ${retryAfter}s`, provider);
    this.name = 'RateLimitError';
  }
}
```

---

## 6. Token tracking

### 6.1 Cost calculator

```typescript
// lib/integrations-shared/src/cost.ts
const RATES_USD_PER_1K = {
  'claude-haiku-4-5-20251001': { input: 0.0008, output: 0.004 },
  'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
  'grok-3-latest': { input: 0.005, output: 0.015 }, // approx, verify
};

const USD_TO_EUR = 0.92; // update periodically

export function calculateCostEur(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rate = RATES_USD_PER_1K[model];
  if (!rate) {
    console.warn(`Unknown model for cost calculation: ${model}`);
    return 0;
  }
  
  const usd = (inputTokens * rate.input + outputTokens * rate.output) / 1000;
  return Math.round(usd * USD_TO_EUR * 10000) / 10000; // 4 decimal places
}
```

### 6.2 Service layer logs cost

```typescript
// In services/ads-strategy/audience.service.ts
const result = await adsStrategy.generateAudienceStrategy({...});

const cost = calculateCostEur(
  result.model,
  result.usage.input_tokens,
  result.usage.output_tokens
);

await adsReportsRepo.create({
  // ... other fields
  costEur: cost,
});
```

---

## 7. Testing integration packages

### 7.1 Mock pattern

```typescript
// __tests__/audience.test.ts
import { vi, describe, it, expect } from 'vitest';
import { generateAudienceStrategy } from '../audience';

vi.mock('../../client', () => ({
  getAnthropicClient: () => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '"personas":[{"rank":1,"name":"Anna"...}}' }],
        usage: { input_tokens: 1000, output_tokens: 500 },
        stop_reason: 'end_turn',
      }),
    },
  }),
}));

describe('generateAudienceStrategy', () => {
  it('parses prefilled JSON correctly', async () => {
    const result = await generateAudienceStrategy({
      systemPrompt: 'system',
      userPrompt: 'user',
      brandId: 'b1',
    });
    
    expect(result.content).toMatchObject({ personas: expect.any(Array) });
    expect(result.usage.input_tokens).toBe(1000);
  });
  
  it('throws MalformedResponseError on invalid JSON', async () => {
    // Override mock to return invalid JSON
    // ...
  });
});
```

### 7.2 Live integration test

```typescript
// __tests__/audience.live.test.ts
import { describe, it, expect } from 'vitest';

describe.skipIf(!process.env.TEST_AI_LIVE)('Audience LIVE', () => {
  it('returns valid output for real input', async () => {
    const result = await generateAudienceStrategy({
      systemPrompt: REAL_SYSTEM_PROMPT,
      userPrompt: REAL_USER_PROMPT,
      brandId: 'test-brand',
    });
    
    // Validate structure
    expect(result.content).toHaveProperty('personas');
    expect(result.content.personas).toHaveLength.greaterThanOrEqual(3);
  }, 30000);
});
```

Run: `TEST_AI_LIVE=1 pnpm test:live`

---

## 8. Checklist khi extend xong mỗi integration

- [ ] Functions exported correctly từ `index.ts`
- [ ] TypeScript types cho input/output đầy đủ
- [ ] Retry logic implemented với appropriate backoff
- [ ] Custom error classes used (no plain `throw new Error`)
- [ ] Token usage returned trong result
- [ ] Unit tests pass với mock
- [ ] Live test pass khi `TEST_AI_LIVE=1`
- [ ] No `any` types
- [ ] No hardcoded API keys
- [ ] Logging useful nhưng không leak sensitive data
- [ ] Package builds without warnings: `pnpm --filter @lib/integrations-X build`

---

## 9. Common pitfalls

| Pitfall | Fix |
|---|---|
| Anthropic JSON response có markdown fences | Use prefill `assistant: '{'` trick |
| Gemini schema reject integer field | Use `Type.INTEGER` not `Type.NUMBER` |
| Gemini structured output không support tất cả JSON Schema | Test manually, fallback to text + parse |
| Grok latency cao với search | Increase timeout to 30s, set retry max=2 |
| Token count không match billing | Use `usage.input_tokens` from response, not estimate |
| Different SDK versions trong workspace | Pin version trong root `package.json` |
