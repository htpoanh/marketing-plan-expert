/**
 * Phase H — generate a KOL post (script + caption + hashtags).
 *
 * Claude writes an in-character German script + caption. The EU AI Act
 * disclosure (effective 2026-08-02) is appended deterministically so every
 * KOL post is labelled — turning compliance into a consistent USP.
 */
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { KolCharacter } from "@workspace/db/schema";

export const KOL_MODEL = "claude-sonnet-4-6";

/** Mandatory disclosure appended to every KOL caption. */
export function disclosureLine(character: { name: string }): string {
  return `Hi, ich bin ${character.name}, eine KI-Figur. #KICharakter #AIFigur`;
}

export function withDisclosure(caption: string, character: { name: string }): string {
  const line = disclosureLine(character);
  if (caption.includes("#KICharakter")) return caption;
  return `${caption.trim()}\n\n${line}`;
}

export type KolDraft = {
  script: string;
  caption: string;
  hashtags: string[];
  tokensInput: number;
  tokensOutput: number;
};

export async function generateKolDraft(
  character: KolCharacter,
  topic: string,
): Promise<KolDraft> {
  const system =
    "Du schreibst Social-Media-Content im Namen einer KI-Influencer-Figur. " +
    "Bleibe konsequent in der Persona, schreibe natürliches Deutsch. Antworte NUR mit JSON.";

  const user = `Charakter: ${character.name} (${character.handle})
Persönlichkeit: ${character.personality ?? "freundlich, authentisch"}
Sprache: Deutsch

Thema: ${topic}

Antworte NUR mit JSON:
{
  "script": "kurzes Sprechskript (~30-45s), Ich-Perspektive der Figur",
  "caption": "Caption für den Post, MAX 150 Zeichen (ohne KI-Hinweis — wird separat angehängt)",
  "hashtags": ["max 8 hashtags ohne #-Zeichen"]
}`;

  const response = await anthropic.messages.create({
    model: KOL_MODEL,
    max_tokens: 1200,
    temperature: 0.85,
    system,
    messages: [
      { role: "user", content: user },
      { role: "assistant", content: "{" },
    ],
  });

  type Block = { type: string; text?: string };
  const block = response.content.find((b: Block) => b.type === "text") as Block | undefined;
  const raw = `{${block?.text ?? ""}`;
  let parsed: { script?: string; caption?: string; hashtags?: string[] };
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`KOL model returned invalid JSON: ${(e as Error).message}`);
  }

  return {
    script: parsed.script ?? "",
    caption: withDisclosure(parsed.caption ?? "", character),
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    tokensInput: response.usage?.input_tokens ?? 0,
    tokensOutput: response.usage?.output_tokens ?? 0,
  };
}
