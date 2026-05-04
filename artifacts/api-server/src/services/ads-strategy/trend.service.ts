/**
 * M4 Trend Pulse — uses Grok 3 with Live Search to surface trends from the
 * last ~7 days that the brand can act on within 7-30 days.
 *
 * Why Grok specifically:
 *   - real-time access to web + X + news (Claude/Gemini both have a training
 *     cutoff that's already a month behind)
 *   - cheap (~€0.025/call)
 *   - the existing lib/integrations-xai package is OpenAI-compatible which
 *     simplifies wrapping
 *
 * Pipeline:
 *   form input + brand
 *   → buildTrendUserPrompt
 *   → Grok 3 chat completion with search_parameters mode=on, sources=[web DE, X, news DE]
 *   → JSON.parse + Zod validate
 *   → estimate cost €
 *   → caller persists to ads_reports
 */
import { grokChatCompletion, GrokError } from "@workspace/integrations-xai";
import type { Brand } from "@workspace/db/schema";
import {
  TREND_PROMPT_VERSION,
  TREND_SYSTEM_PROMPT,
  buildTrendUserPrompt,
  type TrendPromptInput,
} from "./prompts/trend.prompt";
import { trendOutputSchema, type TrendOutput } from "./output-validators";
import { estimateCostEur } from "./cost-calculator";

export const TREND_MODEL = "grok-3-latest";
const MAX_TOKENS = 4000;

export type TrendServiceResult = {
  output: TrendOutput;
  aiProvider: "xai";
  aiModel: string;
  tokensInput: number;
  tokensOutput: number;
  costEur: string | null;
  latencyMs: number;
  promptVersion: string;
  /** Sources the model cited via Live Search — useful for UI badge. */
  citations: string[];
};

export async function getTrendPulse(
  input: TrendPromptInput,
  brand: Brand,
): Promise<TrendServiceResult> {
  const userPrompt = buildTrendUserPrompt(input, brand);
  const startedAt = Date.now();

  let result;
  try {
    result = await grokChatCompletion({
      model: TREND_MODEL,
      temperature: 0.7,
      maxTokens: MAX_TOKENS,
      responseFormat: "json_object",
      messages: [
        { role: "system", content: TREND_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      search: {
        mode: "on",
        sources: [
          { type: "web", country: "DE" },
          { type: "x" },
          { type: "news", country: "DE" },
        ],
        maxSearchResults: 15,
      },
    });
  } catch (e) {
    // Re-throw with a typed-ish error so the handler can decide 502 vs 500
    if (e instanceof GrokError) {
      throw e;
    }
    throw new Error(
      `Grok call failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const latencyMs = Date.now() - startedAt;

  if (!result.text) {
    throw new Error("Grok returned no text content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch (e) {
    throw new Error(
      `Trend model returned invalid JSON: ${(e as Error).message}\nRaw start: ${result.text.slice(0, 400)}`,
    );
  }
  const validated = trendOutputSchema.parse(parsed);

  const tokensInput = result.usage.prompt_tokens ?? 0;
  const tokensOutput = result.usage.completion_tokens ?? 0;
  const costEur = estimateCostEur("xai", TREND_MODEL, tokensInput, tokensOutput);

  return {
    output: validated,
    aiProvider: "xai",
    aiModel: TREND_MODEL,
    tokensInput,
    tokensOutput,
    costEur,
    latencyMs,
    promptVersion: TREND_PROMPT_VERSION,
    citations: result.citations,
  };
}
