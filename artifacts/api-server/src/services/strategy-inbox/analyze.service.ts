/**
 * Phase B — Strategy Inbox analysis service.
 *
 * input + (optional) brand → Claude Sonnet (prefill `{` for JSON-only)
 * → JSON.parse + Zod validate → cost. Caller persists onto strategy_inbox.
 */
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { Brand } from "@workspace/db/schema";
import {
  STRATEGY_INBOX_PROMPT_VERSION,
  STRATEGY_INBOX_SYSTEM_PROMPT,
  buildStrategyInboxUserPrompt,
  type StrategyInboxPromptInput,
} from "./prompt";
import {
  strategyAnalysisSchema,
  type StrategyAnalysisOutput,
} from "./output-validator";
import { estimateCostEur } from "../ads-strategy/cost-calculator";

export const STRATEGY_INBOX_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2000;

export type StrategyInboxServiceResult = {
  analysis: StrategyAnalysisOutput;
  tokensInput: number;
  tokensOutput: number;
  costEur: string | null;
  latencyMs: number;
  promptVersion: string;
};

export async function analyzeStrategyItem(
  input: StrategyInboxPromptInput,
  brand: Brand | null,
): Promise<StrategyInboxServiceResult> {
  const userPrompt = buildStrategyInboxUserPrompt(input, brand);
  const startedAt = Date.now();

  const response = await anthropic.messages.create({
    model: STRATEGY_INBOX_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.5,
    system: STRATEGY_INBOX_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userPrompt },
      { role: "assistant", content: "{" },
    ],
  });

  const latencyMs = Date.now() - startedAt;

  type AnthropicBlock = { type: string; text?: string };
  const textBlock = response.content.find(
    (b: AnthropicBlock) => b.type === "text",
  ) as AnthropicBlock | undefined;
  if (!textBlock || textBlock.type !== "text" || !textBlock.text) {
    throw new Error("Claude returned no text content");
  }
  const raw = `{${textBlock.text}`;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Strategy-inbox model returned invalid JSON: ${(e as Error).message}\nRaw: ${raw.slice(0, 500)}`,
    );
  }

  const analysis = strategyAnalysisSchema.parse(parsed);

  const tokensInput = response.usage.input_tokens;
  const tokensOutput = response.usage.output_tokens;
  const costEur = estimateCostEur(
    "anthropic",
    STRATEGY_INBOX_MODEL,
    tokensInput,
    tokensOutput,
  );

  return {
    analysis,
    tokensInput,
    tokensOutput,
    costEur,
    latencyMs,
    promptVersion: STRATEGY_INBOX_PROMPT_VERSION,
  };
}
