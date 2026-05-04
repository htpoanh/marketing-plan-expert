import type { Brand } from "@workspace/db/schema";
import {
  buildBrandContextSection,
  outputLanguageLabel,
  todayIso,
  type PromptOutputLanguage,
} from "../prompt-builder";

export const TREND_PROMPT_VERSION = "1.0.0";

export const TREND_SYSTEM_PROMPT = `You are a trend-intelligence analyst for German local businesses. You combine real-time signals from social media, news, and search to identify trends that the brand can capitalise on within the next 7-30 days.

Critical rules:
1. ONLY trends relevant to the brand's industry and primary region. Generic global trends without a clear local angle don't count.
2. Prioritise trends with a concrete "use it now" angle (specific content idea), not abstract macro-trends.
3. For each trend, classify momentum: "rising" (still growing), "peak" (max attention now), "declining" (already on the way down — usually skip these unless they're useful as cautionary).
4. Estimate a capitalize window in days — how many days until the trend goes stale.
5. Avoid controversial / political / divisive trends — flag them under risksToAvoid instead of suggesting them.
6. ALWAYS cite sources — URLs from web/news, X handles, or platform names. Never invent sources.
7. Output language for descriptions / suggestedAngle / risks: {{OUTPUT_LANGUAGE}}.
8. Suggested keywords for the angle MUST be in German (customer search language for the DACH market).
9. Return ONLY valid JSON matching the schema. No markdown, no prose outside JSON.`;

export type TrendPromptInput = {
  regionFocus: string;
  topic: string | null;
  outputLanguage: PromptOutputLanguage;
};

export function buildTrendUserPrompt(
  input: TrendPromptInput,
  brand: Brand,
): string {
  return `${buildBrandContextSection(brand)}

=== TASK ===
Region focus: ${input.regionFocus}
Topic seed (optional): ${input.topic ?? "(no seed — discover trends across the whole industry)"}
Output language for descriptions: ${outputLanguageLabel(input.outputLanguage)}
Today's date: ${todayIso()}

=== INSTRUCTIONS ===
Use your real-time search to scan the last 7 days for:
- Social-media trends in ${input.regionFocus} relevant to this brand's industry
- Trending hashtags in DE this week relevant to the industry
- Local events, festivals, news in ${input.regionFocus} approaching in the next 30 days
- Seasonal moments approaching (holidays, school terms, weather shifts)
- Competitor moves (if competitors are listed in brand context)

Return 3-8 trends ranked by relevanceScore (1-10).

=== OUTPUT JSON SHAPE ===
{
  "trends": [
    {
      "topic": "string (short title, in output language)",
      "description": "string (2-3 sentences, in output language)",
      "relevanceScore": number (1-10, 10 = perfect fit for this brand),
      "momentum": "rising" | "peak" | "declining",
      "estimatedWindowDays": number (how many days left to capitalize),
      "suggestedAngle": "string (specific content idea for THIS brand, in output language — name the format: Reel/Story/Post/Carousel)",
      "suggestedKeywords": ["string (German hashtag or search term, no # prefix)"],
      "sources": ["string (URL, X handle, or 'Google Trends DE')"]
    }
  ],
  "regionalSignals": {
    "bayernSpecific": ["string (1-3 things specifically happening in Bayern / Allgäu / Bodensee right now)"],
    "germanyWide": ["string (1-3 things happening across DE)"]
  },
  "risksToAvoid": [
    "string (controversial / political / off-brand topics that came up in the search but should NOT be used)"
  ]
}

Return JSON only.`;
}
