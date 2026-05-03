/**
 * M3 Performance Reality service.
 *
 * Pipeline:
 *   raw CSV string + brand + goals
 *   → parseAdsCsv (format detection + normalisation + aggregate stats)
 *   → buildPerformanceUserPrompt (top/bottom/all rows + brand context)
 *   → Claude Sonnet 4.5 (with prefill `{` for JSON-only output)
 *   → JSON.parse + Zod validate
 *   → estimate cost €
 *   → caller persists to ads_reports
 *
 * Sonnet is the right model for M3 because:
 *   - longer context (we send full CSV summary)
 *   - better reasoning over numerical data than Haiku
 *   - better at picking out patterns across many rows
 *
 * Prompt budget: ~7-9k input tokens (full prompt + 30-row CSV) + ~2-3k output
 * → ~€0.05-0.08 per call. Cache layer (cache.ts) makes duplicate runs free.
 */
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { Brand } from "@workspace/db/schema";
import {
  parseAdsCsv,
  selectTopAndBottom,
  CsvParseError,
} from "./csv-parser";
import {
  PERFORMANCE_PROMPT_VERSION,
  PERFORMANCE_SYSTEM_PROMPT,
  buildPerformanceUserPrompt,
  type PerformancePromptInput,
} from "./prompts/performance.prompt";
import {
  performanceOutputSchema,
  type PerformanceOutput,
} from "./output-validators";
import { estimateCostEur } from "./cost-calculator";

export const PERFORMANCE_MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 6000; // Sonnet output budget — enough for 5 hypotheses + reallocation table
const MAX_ROWS_TO_SEND = 50; // Trim very large CSVs so prompt stays bounded

export type PerformanceServiceInput = {
  csvData: string;
  goal: PerformancePromptInput["goal"];
  outputLanguage: PerformancePromptInput["outputLanguage"];
};

export type PerformanceServiceResult = {
  output: PerformanceOutput;
  aiProvider: "anthropic";
  aiModel: string;
  tokensInput: number;
  tokensOutput: number;
  costEur: string | null;
  latencyMs: number;
  promptVersion: string;
  /** Detected platform (returned so the handler can echo it back to the UI). */
  detectedPlatform: "meta" | "google";
  /** Aggregate stats from the parsed CSV — useful for the result panel. */
  parsedStats: {
    rowCount: number;
    totalSpendEur: number;
    totalConversions: number;
  };
};

export { CsvParseError };

export async function analyzePerformance(
  input: PerformanceServiceInput,
  brand: Brand,
): Promise<PerformanceServiceResult> {
  // 1. Parse CSV (CsvParseError surfaces straight to handler → 400)
  const parsed = parseAdsCsv(input.csvData);

  // 2. Pick the most relevant rows so the prompt fits in ~9k tokens regardless
  // of CSV size. We send: top-10 spenders, bottom-10 by CPA (likely waste),
  // and up to MAX_ROWS_TO_SEND of the rest deduplicated.
  const top10ByCpa = selectTopAndBottom(parsed.rows, "cpaEur", 10);
  const top10BySpend = selectTopAndBottom(parsed.rows, "spendEur", 10);
  const sampledKey = (r: { campaign: string; adSet: string; ad: string | null }) =>
    `${r.campaign}::${r.adSet}::${r.ad ?? ""}`;
  const seen = new Set<string>();
  const sampleRows: typeof parsed.rows = [];
  for (const row of [
    ...top10BySpend.top,
    ...top10ByCpa.bottom, // worst CPA = most waste
    ...parsed.rows,
  ]) {
    const key = sampledKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    sampleRows.push(row);
    if (sampleRows.length >= MAX_ROWS_TO_SEND) break;
  }

  const userPrompt = buildPerformanceUserPrompt(
    {
      platform: parsed.platform,
      goal: input.goal,
      outputLanguage: input.outputLanguage,
    },
    brand,
    parsed.stats,
    top10BySpend.top,
    top10ByCpa.bottom,
    sampleRows,
  );

  // 3. Call Sonnet with prefill trick to force JSON-only output
  const startedAt = Date.now();
  const response = await anthropic.messages.create({
    model: PERFORMANCE_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.5, // Lower than M1 — analytical, not creative
    system: PERFORMANCE_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userPrompt },
      { role: "assistant", content: "{" },
    ],
  });
  const latencyMs = Date.now() - startedAt;

  // 4. Reassemble + parse + validate
  type AnthropicBlock = { type: string; text?: string };
  const textBlock = response.content.find(
    (b: AnthropicBlock) => b.type === "text",
  ) as AnthropicBlock | undefined;
  if (!textBlock || textBlock.type !== "text" || !textBlock.text) {
    throw new Error("Claude returned no text content for performance analysis");
  }
  const raw = `{${textBlock.text}`;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Performance model returned invalid JSON: ${(e as Error).message}\nRaw start: ${raw.slice(0, 400)}`,
    );
  }
  const validated = performanceOutputSchema.parse(parsedJson);

  const tokensInput = response.usage.input_tokens;
  const tokensOutput = response.usage.output_tokens;
  const costEur = estimateCostEur(
    "anthropic",
    PERFORMANCE_MODEL,
    tokensInput,
    tokensOutput,
  );

  return {
    output: validated,
    aiProvider: "anthropic",
    aiModel: PERFORMANCE_MODEL,
    tokensInput,
    tokensOutput,
    costEur,
    latencyMs,
    promptVersion: PERFORMANCE_PROMPT_VERSION,
    detectedPlatform: parsed.platform === "mixed" ? "meta" : parsed.platform,
    parsedStats: {
      rowCount: parsed.stats.rowCount,
      totalSpendEur: parsed.stats.totalSpendEur,
      totalConversions: parsed.stats.totalConversions,
    },
  };
}
