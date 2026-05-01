import type { Brand } from "@workspace/db/schema";
import {
  buildBrandContextSection,
  outputLanguageLabel,
  todayIso,
  type PromptOutputLanguage,
} from "../prompt-builder";

export const KEYWORDS_PROMPT_VERSION = "1.0.0";

export const KEYWORDS_SYSTEM_PROMPT = `You are a senior SEM specialist focused on the DACH market and local service businesses. You specialise in finding "money keywords" — terms with high buying intent that smaller businesses can actually rank or bid on profitably.

Critical rules:
1. Keywords MUST be in German (customer language), regardless of the requested output language. Customers search in German; we ad-bid in German.
2. Volume / CPC are estimates — every estimate must be flagged clearly.
3. Prioritise BUYING INTENT over volume. A 50-search/month keyword that books a customer beats a 10k-search/month keyword that doesn't.
4. Long-tail must be specific (geo + situation + intent).
5. Defensive keywords: include competitor brand terms ONLY when competitors are provided in the brand context.
6. The "useCaseNote" / explanations / warnings use the requested output language.
7. Return ONLY valid JSON matching the schema. No prose, no markdown fences.`;

export type KeywordsPromptInput = {
  service: string;
  competitors: string[];
  outputLanguage: PromptOutputLanguage;
};

export function buildKeywordsUserPrompt(
  input: KeywordsPromptInput,
  brand: Brand,
): string {
  return `${buildBrandContextSection(brand)}

=== TASK ===
Service: ${input.service}
Additional competitor names provided by the user (use for defensiveKeywords): ${input.competitors.length > 0 ? input.competitors.join(", ") : "(none)"}
Output language for notes / warnings: ${outputLanguageLabel(input.outputLanguage)}
Today's date: ${todayIso()}

=== REQUIREMENTS ===
Generate exactly 4 keyword groups:

1. moneyKeywords — high buying intent, immediate action.
   Pattern: [service] + [city] + [action: termin, buchen, online].
   Target 8-12 keywords.

2. discoveryKeywords — pre-purchase research, trend-driven.
   Pattern: [trend/style] + [year/season], [problem] + lösung / hilfe.
   Target 6-12 keywords.

3. defensiveKeywords — competitor brand terms.
   Empty array if no competitors are known.
   Otherwise 4-10 keywords, one per competitor + variants.

4. longTailBooking — specific situation + booking intent.
   Pattern: [situation] + [service] + [city/region] + [booking signal].
   Target 5-10 keywords.

For each keyword:
{
  "text": "string (German, lowercase)",
  "intentScore": number (1-10, 10 = direct buy intent),
  "estimatedVolume": "Low" | "Medium" | "High",
  "estimatedCpcEur": "string (e.g. '€0.50-1.20 ESTIMATE')",
  "matchTypeRecommended": "exact" | "phrase" | "broad",
  "useCaseNote": "string (when/where to use, in the requested output language)"
}

Plus:
- "warnings": array of strings (in output language) about risks, ambiguity, etc.
- "verificationChecklist": array of 3-5 strings (in output language) — concrete things the user should verify in Google Keyword Planner / Search Console before launching.
  At least one item MUST mention Google Keyword Planner.

Return JSON only.`;
}
