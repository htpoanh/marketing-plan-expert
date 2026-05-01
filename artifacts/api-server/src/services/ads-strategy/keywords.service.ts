/**
 * M2 Keyword Weight service.
 *
 * Pipeline:
 *   form input + brand row
 *   → buildKeywordsUserPrompt
 *   → Gemini 2.5 Flash with structured-output (responseMimeType=application/json)
 *   → JSON.parse + Zod validate
 *   → estimate cost €
 *   → caller persists to ads_reports
 */
import { ai as gemini } from "@workspace/integrations-gemini-ai";
import type { Brand } from "@workspace/db/schema";
import {
  KEYWORDS_PROMPT_VERSION,
  KEYWORDS_SYSTEM_PROMPT,
  buildKeywordsUserPrompt,
  type KeywordsPromptInput,
} from "./prompts/keywords.prompt";
import {
  keywordsOutputSchema,
  type KeywordsOutput,
} from "./output-validators";
import { estimateCostEur } from "./cost-calculator";

export const KEYWORDS_MODEL = "gemini-2.5-flash";

export type KeywordsServiceResult = {
  output: KeywordsOutput;
  aiProvider: "google";
  aiModel: string;
  tokensInput: number;
  tokensOutput: number;
  costEur: string | null;
  latencyMs: number;
  promptVersion: string;
};

export async function generateKeywords(
  input: KeywordsPromptInput,
  brand: Brand,
): Promise<KeywordsServiceResult> {
  const userPrompt = buildKeywordsUserPrompt(input, brand);
  const startedAt = Date.now();

  const response = await gemini.models.generateContent({
    model: KEYWORDS_MODEL,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: KEYWORDS_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 4000,
    },
  });

  const latencyMs = Date.now() - startedAt;

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned no text content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Keywords model returned invalid JSON: ${(e as Error).message}\nRaw: ${text.slice(0, 500)}`,
    );
  }

  const validated = keywordsOutputSchema.parse(parsed);

  const usage = response.usageMetadata;
  const tokensInput = usage?.promptTokenCount ?? 0;
  const tokensOutput =
    usage?.candidatesTokenCount ?? usage?.totalTokenCount ?? 0;
  const costEur = estimateCostEur(
    "google",
    KEYWORDS_MODEL,
    tokensInput,
    tokensOutput,
  );

  return {
    output: validated,
    aiProvider: "google",
    aiModel: KEYWORDS_MODEL,
    tokensInput,
    tokensOutput,
    costEur,
    latencyMs,
    promptVersion: KEYWORDS_PROMPT_VERSION,
  };
}
