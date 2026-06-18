/**
 * Phase G — German reply drafting (Claude).
 *
 * Centralised so the comment webhook and the review job produce consistent,
 * on-brand German replies. Uses Claude Sonnet (same model the existing review
 * reply path uses) with the brand's resolved voice + fixed sign-off.
 */

import { anthropic } from "@workspace/integrations-anthropic-ai";
import { resolveBrandVoice, withSignOff } from "./brand-voice";
import type { Intent } from "./intent-classifier";

export type GenerateReplyInput = {
  brand: { brandName?: string | null; brandVoice?: string | null; industry?: string | null };
  channel: "google" | "facebook" | "instagram";
  /** The customer's message / review text. */
  message: string;
  intent?: Intent;
  /** Google review star rating, if applicable. */
  rating?: number;
  /** Add a subtle "come back" invitation (3-4★ reviews). */
  addInvite?: boolean;
  /** Reply is private (DM) vs public — affects length/format hint. */
  replyMode?: "public" | "private";
};

const CHANNEL_LABEL: Record<GenerateReplyInput["channel"], string> = {
  google: "eine Google-Bewertung",
  facebook: "einen Facebook-Kommentar",
  instagram: "einen Instagram-Kommentar",
};

function buildIntentGuidance(input: GenerateReplyInput): string {
  if (input.channel === "google" && typeof input.rating === "number") {
    if (input.rating >= 5) return "Drücke aufrichtige Freude und Dankbarkeit aus.";
    if (input.rating >= 3)
      return "Bedanke dich, würdige das Feedback und lade den Gast subtil zu einem erneuten Besuch ein.";
    return "Entschuldige dich aufrichtig und biete an, das Anliegen direkt zu klären.";
  }
  switch (input.intent) {
    case "booking":
      return "Reagiere hilfsbereit auf die Terminanfrage und nenne die nächsten Schritte zur Buchung.";
    case "price":
      return "Beantworte die Preisanfrage freundlich; nenne ggf. eine Preisspanne und lade zum Kontakt ein. KEINE Rabatte versprechen.";
    case "compliment":
      return "Bedanke dich herzlich und persönlich für das Lob.";
    case "complaint":
      return "Zeige Verständnis, entschuldige dich und biete eine direkte Klärung an. KEINE Rabatte/Erstattungen versprechen.";
    default:
      return "Antworte freundlich und hilfsbereit.";
  }
}

/**
 * Returns the drafted reply (already including the brand sign-off) plus token
 * usage so callers can persist cost if they want.
 */
export async function generateReply(
  input: GenerateReplyInput,
): Promise<{ reply: string; tokensInput: number; tokensOutput: number }> {
  const voice = resolveBrandVoice(input.brand);
  const lengthHint =
    input.replyMode === "private"
      ? "2-4 Sätze, persönlich"
      : "1-3 Sätze, knapp und öffentlich passend";

  const system =
    "Du bist ein professioneller deutschsprachiger Kundenservice-Experte. " +
    "Du schreibst empathische, authentische, natürliche Antworten — niemals robotisch. " +
    "Du versprichst NIEMALS Rabatte, Gutscheine oder Erstattungen.";

  const user = `Unternehmen: "${input.brand.brandName ?? "unser Unternehmen"}"${
    input.brand.industry ? ` (Branche: ${input.brand.industry})` : ""
  }
Markenstimme/Ton: ${voice.tone}
Du antwortest auf ${CHANNEL_LABEL[input.channel]}.
${buildIntentGuidance(input)}

Nachricht des Kunden:
"""${(input.message ?? "(kein Text)").slice(0, 1500)}"""

Anforderungen:
- Schreibe auf Deutsch, ${lengthHint}
- Verwende den Kundennamen NICHT erfinden
- Gib NUR den Antworttext zurück, ohne Anführungszeichen, ohne Grußzeile am Ende (die Signatur wird separat angehängt)`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system,
    messages: [{ role: "user", content: user }],
  });

  const block = message.content[0];
  const raw =
    block.type === "text"
      ? block.text.trim()
      : "Vielen Dank für Ihre Nachricht! Wir melden uns gerne bei Ihnen.";

  return {
    reply: withSignOff(raw, voice.signOff),
    tokensInput: message.usage?.input_tokens ?? 0,
    tokensOutput: message.usage?.output_tokens ?? 0,
  };
}
