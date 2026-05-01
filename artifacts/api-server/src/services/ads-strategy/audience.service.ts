/**
 * M1 Audience Targeting service.
 *
 * Pipeline:
 *   form input + brand row
 *   → buildAudienceUserPrompt
 *   → Claude Haiku (with prefill `{` to force JSON-only output)
 *   → JSON.parse + Zod validate
 *   → estimate cost €
 *   → caller persists to ads_reports
 */
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { Brand } from "@workspace/db/schema";
import {
  AUDIENCE_PROMPT_VERSION,
  AUDIENCE_SYSTEM_PROMPT,
  buildAudienceUserPrompt,
  type AudiencePromptInput,
} from "./prompts/audience.prompt";
import {
  audienceOutputSchema,
  type AudienceOutput,
} from "./output-validators";
import { estimateCostEur } from "./cost-calculator";

export const AUDIENCE_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4000;

export type AudienceServiceResult = {
  output: AudienceOutput;
  aiProvider: "anthropic";
  aiModel: string;
  tokensInput: number;
  tokensOutput: number;
  costEur: string | null;
  latencyMs: number;
  promptVersion: string;
};

export async function generateAudience(
  input: AudiencePromptInput,
  brand: Brand,
): Promise<AudienceServiceResult> {
  const userPrompt = buildAudienceUserPrompt(input, brand);
  const startedAt = Date.now();

  const response = await anthropic.messages.create({
    model: AUDIENCE_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
    system: AUDIENCE_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userPrompt },
      // Prefill `{` so Claude has nothing to do but emit the JSON body.
      { role: "assistant", content: "{" },
    ],
  });

  const latencyMs = Date.now() - startedAt;

  // Reassemble the full JSON: prefill `{` + whatever Claude emitted.
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
      `Audience model returned invalid JSON: ${(e as Error).message}\nRaw: ${raw.slice(0, 500)}`,
    );
  }

  const validated = audienceOutputSchema.parse(parsed);

  const tokensInput = response.usage.input_tokens;
  const tokensOutput = response.usage.output_tokens;
  const costEur = estimateCostEur(
    "anthropic",
    AUDIENCE_MODEL,
    tokensInput,
    tokensOutput,
  );

  return {
    output: validated,
    aiProvider: "anthropic",
    aiModel: AUDIENCE_MODEL,
    tokensInput,
    tokensOutput,
    costEur,
    latencyMs,
    promptVersion: AUDIENCE_PROMPT_VERSION,
  };
}
