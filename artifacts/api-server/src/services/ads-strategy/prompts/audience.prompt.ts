import type { Brand } from "@workspace/db/schema";
import {
  buildBrandContextSection,
  outputLanguageLabel,
  todayIso,
  type PromptOutputLanguage,
} from "../prompt-builder";

export const AUDIENCE_PROMPT_VERSION = "1.0.0";

export const AUDIENCE_SYSTEM_PROMPT = `You are an elite paid-ads strategist with 10+ years of experience in the DACH market (Germany, Austria, Switzerland), specialising in local service businesses and SMB e-commerce in Bayern / Allgäu.

Your task: turn a brand brief into hyper-specific personas and ad-targeting configs that map directly to Meta Ads Manager and Google Ads.

Critical rules:
1. Personas must be REAL — name, age, profession, neighborhood, daily routine. Never write generic "women 25-45 interested in beauty".
2. Targeting must be DIRECTLY USABLE — output Meta JSON exactly as Ads Manager expects.
3. ALL string values in the customer-facing output (persona names, ad-set names, interests) MUST be in German — Meta indexes interests in German for DE accounts. The "internal explanations" / "next_steps" / "reasoning" use the requested output language.
4. Be honest about uncertainty — every audience-size estimate must include the marker "ESTIMATE" or "Schätzung".
5. Quality over quantity — 3 sharp personas beats 7 vague ones.
6. Return ONLY valid JSON matching the schema. No prose, no markdown fences, no commentary.`;

export type AudiencePromptInput = {
  service: string;
  campaignGoal: "awareness" | "traffic" | "leads" | "conversions" | "retention";
  budgetEur: number | null;
  outputLanguage: PromptOutputLanguage;
};

export function buildAudienceUserPrompt(
  input: AudiencePromptInput,
  brand: Brand,
): string {
  return `${buildBrandContextSection(brand)}

=== TASK ===
Service to advertise: ${input.service}
Campaign goal: ${input.campaignGoal}
Monthly budget: ${input.budgetEur != null ? `€${input.budgetEur}` : "(not specified)"}
Output language for explanations / notes: ${outputLanguageLabel(input.outputLanguage)}
Today's date: ${todayIso()}

=== REQUIREMENTS ===
1. Generate 3-5 personas ranked by priority (rank 1 = most important).
2. Each persona needs Meta + Google targeting that maps to Ads Manager.
3. Include 1 "negativeAudiences" array explaining who to EXCLUDE and why.
4. Include estimated audience size for each persona (must contain "ESTIMATE" or "Schätzung").
5. Include budgetSplit (percentages must sum to 100).
6. Provide 3-5 actionable nextSteps.

=== OUTPUT JSON SHAPE ===
{
  "personas": [
    {
      "rank": 1,
      "name": "string (German first name)",
      "age": number,
      "profession": "string (German)",
      "locationDetail": "string (German neighborhood/area)",
      "demographics": {
        "gender": "male" | "female" | "diverse",
        "familyStatus": "string",
        "incomeBracket": "string",
        "education": "string | null"
      },
      "psychographics": {
        "values": ["string"],
        "aspirations": ["string"],
        "fears": ["string"]
      },
      "onlineBehavior": {
        "platforms": ["instagram" | "facebook" | "tiktok" | "youtube" | "..."],
        "activeHours": "string (e.g. 'evenings 19-22h')",
        "follows": ["string (example accounts)"],
        "consumptionPattern": "string"
      },
      "painPoints": ["string"],
      "buyingTriggers": ["string"],
      "budgetPerPurchase": "string (€X-Y range)",
      "estimatedAudienceSize": "string (must contain ESTIMATE or Schätzung)"
    }
  ],
  "metaTargeting": [
    {
      "personaRank": 1,
      "adSetName": "string (German, ready to use)",
      "location": {
        "type": "radius" | "city" | "region",
        "address": "string",
        "radiusKm": number
      },
      "ageRange": [number, number],
      "gender": "all" | "female" | "male",
      "interests": ["string (exact Meta interest name in German)"],
      "behaviors": ["string"],
      "lookalikeSource": "string | null",
      "advantagePlusRecommended": boolean
    }
  ],
  "googleTargeting": [
    {
      "personaRank": 1,
      "campaignType": "search" | "display" | "pmax" | "demand_gen",
      "keywordThemes": ["string"],
      "demographicFilters": {
        "ageRanges": ["string"],
        "householdIncome": "string | null",
        "parentalStatus": "string | null"
      }
    }
  ],
  "negativeAudiences": [
    { "exclude": "string", "reason": "string" }
  ],
  "budgetSplit": [
    { "personaRank": 1, "percentage": 50, "amountEur": 250, "reason": "string" }
  ],
  "nextSteps": ["string (3-5 items)"]
}

Return JSON only.`;
}
