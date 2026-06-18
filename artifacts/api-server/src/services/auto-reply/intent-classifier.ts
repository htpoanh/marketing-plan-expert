/**
 * Phase G — Intent classifier for inbound comments/messages.
 *
 * Two layers:
 *   1. classifyIntentByKeywords() — pure, synchronous, zero-cost. German
 *      keyword matching per the v3.0 spec, extended with common variants.
 *      This is what the webhook uses on the hot path.
 *   2. refineIntentWithAI() — optional async fallback (Claude Haiku) used only
 *      when the keyword pass is low-confidence ("other"). Kept separate so
 *      tests stay offline and the webhook can stay cheap.
 */

import { anthropic } from "@workspace/integrations-anthropic-ai";

export type Intent = "booking" | "price" | "complaint" | "compliment" | "other";

export type IntentResult = {
  intent: Intent;
  /** -1.00 .. 1.00 — derived from intent + matched terms. */
  sentiment: number;
  /** 0..1 — how confident the keyword pass is. */
  confidence: number;
  /** Which keywords triggered the match (for debugging / UI). */
  matched: string[];
};

/**
 * Keyword tables. Order matters: complaint is checked first (safety — never
 * want to mislabel an angry message as a compliment), then booking, price,
 * compliment.
 */
const KEYWORDS: { intent: Exclude<Intent, "other">; terms: string[] }[] = [
  {
    intent: "complaint",
    terms: [
      "schlecht", "enttäuscht", "enttaeuscht", "nie wieder", "katastrophe",
      "unverschämt", "unverschaemt", "frech", "betrug", "abzocke",
      "schmutzig", "dreckig", "unhöflich", "unhoeflich", "warten",
      "schlechtester", "schrecklich", "furchtbar", "beschwerde", "ärgerlich",
      "aergerlich", "nicht empfehlen", "reklamation",
    ],
  },
  {
    intent: "booking",
    terms: [
      "termin", "buchen", "buchung", "reservieren", "reservierung",
      "wann", "frei", "verfügbar", "verfuegbar", "anmelden", "vereinbaren",
      "appointment", "slot", "uhrzeit frei", "kann ich kommen",
    ],
  },
  {
    intent: "price",
    terms: [
      "preis", "preise", "kosten", "kostet", "wie viel", "wieviel",
      "wie teuer", "günstig", "guenstig", "angebot", "rabatt fragen",
      "preisliste", "was kostet", "€", "euro",
    ],
  },
  {
    intent: "compliment",
    terms: [
      "super", "toll", "empfehle", "empfehlen", "beste", "bester", "klasse",
      "wunderbar", "perfekt", "lecker", "fantastisch", "großartig",
      "grossartig", "liebe es", "danke", "weiter so", "top", "mega",
      "sehr gut", "wunderschön", "wunderschoen",
    ],
  },
];

const SENTIMENT_BY_INTENT: Record<Intent, number> = {
  complaint: -0.8,
  compliment: 0.85,
  booking: 0.3,
  price: 0.1,
  other: 0,
};

export function classifyIntentByKeywords(text: string): IntentResult {
  const haystack = (text ?? "").toLowerCase();

  if (!haystack.trim()) {
    return { intent: "other", sentiment: 0, confidence: 0, matched: [] };
  }

  for (const { intent, terms } of KEYWORDS) {
    const matched = terms.filter((t) => haystack.includes(t));
    if (matched.length > 0) {
      // Confidence scales gently with number of hits, capped.
      const confidence = Math.min(0.6 + 0.15 * matched.length, 0.95);
      return {
        intent,
        sentiment: SENTIMENT_BY_INTENT[intent],
        confidence,
        matched,
      };
    }
  }

  return { intent: "other", sentiment: 0, confidence: 0.2, matched: [] };
}

const VALID_INTENTS: Intent[] = ["booking", "price", "complaint", "compliment", "other"];

/**
 * AI fallback — only call this when the keyword pass returned "other" and you
 * want a smarter read. Uses Claude Haiku (cheap, fast). Returns the keyword
 * result on any error so the caller never has to special-case failure.
 */
export async function refineIntentWithAI(
  text: string,
  keywordResult: IntentResult,
): Promise<IntentResult> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system:
        "Du klassifizierst deutsche Kundennachrichten/-kommentare. Antworte NUR mit JSON: " +
        '{"intent":"booking|price|complaint|compliment|other","sentiment":-1.0..1.0}. Keine Erklärung.',
      messages: [{ role: "user", content: text.slice(0, 1000) }],
    });
    const block = message.content[0];
    const raw = block.type === "text" ? block.text.trim() : "{}";
    const jsonStart = raw.indexOf("{");
    const parsed = JSON.parse(raw.slice(jsonStart >= 0 ? jsonStart : 0)) as {
      intent?: string;
      sentiment?: number;
    };
    const intent = VALID_INTENTS.includes(parsed.intent as Intent)
      ? (parsed.intent as Intent)
      : "other";
    const sentiment =
      typeof parsed.sentiment === "number"
        ? Math.max(-1, Math.min(1, parsed.sentiment))
        : SENTIMENT_BY_INTENT[intent];
    return { intent, sentiment, confidence: 0.7, matched: ["ai"] };
  } catch {
    return keywordResult;
  }
}
