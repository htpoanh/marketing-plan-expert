/**
 * M4 Trend Pulse — uses Claude with the native Web Search tool to surface
 * trends from the last ~7 days that the brand can act on within 7-30 days,
 * including German keyword research for the angle.
 *
 * Why Claude Web Search:
 *   - real-time access to the web/news via Anthropic's server-side search tool
 *     (no separate provider, no extra API key, no data fragmentation)
 *   - keeps the whole trend + content brain on one model (Claude) so the
 *     weekly report and the assistant share the same reasoning
 *   - citations come back inline from the search results → UI source badges
 *
 * Pipeline:
 *   form input + brand
 *   → buildTrendUserPrompt
 *   → Claude (web_search tool enabled) — searches DE web/news, then answers
 *   → extract JSON from the final text + JSON.parse + Zod validate
 *   → estimate cost €
 *   → caller persists to ads_reports / trend_insights
 */
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { Brand } from "@workspace/db/schema";
import {
  TREND_PROMPT_VERSION,
  TREND_SYSTEM_PROMPT,
  buildTrendUserPrompt,
  type TrendPromptInput,
} from "./prompts/trend.prompt";
import { trendOutputSchema, type TrendOutput } from "./output-validators";
import { estimateCostEur } from "./cost-calculator";

export const TREND_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4000;
const MAX_SEARCHES = 5;

export type TrendServiceResult = {
  output: TrendOutput;
  aiProvider: "anthropic";
  aiModel: string;
  tokensInput: number;
  tokensOutput: number;
  costEur: string | null;
  latencyMs: number;
  promptVersion: string;
  /** Source URLs Claude cited via Web Search — useful for UI badge. */
  citations: string[];
};

/**
 * Integration-boundary shapes for Claude's content blocks. We narrow `unknown`
 * here (this is the AI integration layer) rather than leaking it upward.
 */
type TextBlockLike = { type: string; text?: string };
type SearchResultItemLike = { type?: string; url?: string };
type SearchResultBlockLike = { type: string; content?: unknown };

function extractText(content: unknown[]): string {
  return content
    .filter((b): b is TextBlockLike => {
      const block = b as TextBlockLike;
      return block.type === "text" && typeof block.text === "string";
    })
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
}

function extractCitations(content: unknown[]): string[] {
  const urls = new Set<string>();
  for (const b of content) {
    const block = b as SearchResultBlockLike;
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) {
      continue;
    }
    for (const item of block.content as SearchResultItemLike[]) {
      if (item?.type === "web_search_result" && typeof item.url === "string") {
        urls.add(item.url);
      }
    }
  }
  return [...urls];
}

/** Pull the JSON object out of a possibly-chatty final message. */
function extractJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error(
      `Trend model returned no JSON object.\nRaw start: ${text.slice(0, 400)}`,
    );
  }
  return text.slice(first, last + 1);
}

export async function getTrendPulse(
  input: TrendPromptInput,
  brand: Brand,
): Promise<TrendServiceResult> {
  const userPrompt = buildTrendUserPrompt(input, brand);
  const startedAt = Date.now();

  const response = await anthropic.messages.create({
    model: TREND_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
    system: TREND_SYSTEM_PROMPT,
    tools: [
      {
        type: "web_search_20250305" as const,
        name: "web_search" as const,
        max_uses: MAX_SEARCHES,
        user_location: { type: "approximate" as const, country: "DE" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const latencyMs = Date.now() - startedAt;

  const text = extractText(response.content);
  if (!text) {
    throw new Error("Claude returned no text content for trend pulse");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(text));
  } catch (e) {
    throw new Error(
      `Trend model returned invalid JSON: ${(e as Error).message}\nRaw start: ${text.slice(0, 500)}`,
    );
  }
  const validated = trendOutputSchema.parse(parsed);

  const tokensInput = response.usage.input_tokens;
  const tokensOutput = response.usage.output_tokens;
  const costEur = estimateCostEur("anthropic", TREND_MODEL, tokensInput, tokensOutput);

  return {
    output: validated,
    aiProvider: "anthropic",
    aiModel: TREND_MODEL,
    tokensInput,
    tokensOutput,
    costEur,
    latencyMs,
    promptVersion: TREND_PROMPT_VERSION,
    citations: extractCitations(response.content),
  };
}
