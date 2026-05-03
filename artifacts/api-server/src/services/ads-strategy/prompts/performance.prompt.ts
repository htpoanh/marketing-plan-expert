import type { Brand } from "@workspace/db/schema";
import {
  buildBrandContextSection,
  outputLanguageLabel,
  todayIso,
  type PromptOutputLanguage,
} from "../prompt-builder";
import type {
  AggregateStats,
  AdsPlatform,
  NormalizedAdRow,
} from "../csv-parser";

export const PERFORMANCE_PROMPT_VERSION = "1.0.0";

export const PERFORMANCE_SYSTEM_PROMPT = `You are a performance-marketing analyst with experience optimising six-figure ad budgets for SMBs in the DACH market. You specialise in finding leverage points — small changes that cause big shifts in ROAS / CPL.

Your task: analyse one month of ad performance data for a single brand and produce a brutally honest, actionable report.

Critical rules:
1. Be brutally honest about waste — if a campaign / ad-set is burning money, name it and quote the € amount.
2. Never recommend generic "test more creatives" — every recommendation must reference SPECIFIC rows from the data.
3. Pattern-match across rows — find what TYPE of ad / placement / audience works, not just one-off winners.
4. Every recommendation MUST include: action + reason (tied to evidence) + expected impact.
5. Distinguish CORRELATION from CAUSATION — flag patterns based on small samples (<5 rows) explicitly.
6. Output language for explanations / reasoning: {{OUTPUT_LANGUAGE}}.
7. Campaign / ad-set names stay verbatim from the data (do not translate them).
8. Return ONLY valid JSON matching the schema. No prose, no markdown fences, no commentary.`;

export type PerformancePromptInput = {
  platform: AdsPlatform;
  goal: {
    cplTargetEur: number | null;
    avgTicketEur: number | null;
    roasTarget: number | null;
  };
  outputLanguage: PromptOutputLanguage;
};

export function buildPerformanceUserPrompt(
  input: PerformancePromptInput,
  brand: Brand,
  stats: AggregateStats,
  topPerformers: NormalizedAdRow[],
  bottomPerformers: NormalizedAdRow[],
  fullSampleRows: NormalizedAdRow[],
): string {
  const platformLabel =
    input.platform === "meta"
      ? "Meta Ads (Facebook + Instagram)"
      : input.platform === "google"
        ? "Google Ads"
        : "Mixed Meta + Google";

  // Compact JSON-stringify rows so the model gets structured data without
  // burning tokens on whitespace.
  const compactRow = (r: NormalizedAdRow) => ({
    campaign: r.campaign,
    adSet: r.adSet,
    ad: r.ad,
    spendEur: r.spendEur,
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: r.ctr,
    cpcEur: r.cpcEur,
    conversions: r.conversions,
    cpaEur: r.cpaEur,
    ...(r.conversionValueEur != null
      ? { conversionValueEur: r.conversionValueEur, roas: r.roas }
      : {}),
  });

  return `${buildBrandContextSection(brand)}

=== PERFORMANCE DATA ===
Platform: ${platformLabel}
CPL target: ${input.goal.cplTargetEur != null ? `€${input.goal.cplTargetEur}` : "(not specified)"}
Average ticket size: ${input.goal.avgTicketEur != null ? `€${input.goal.avgTicketEur}` : "(use brand context)"}
ROAS target: ${input.goal.roasTarget != null ? input.goal.roasTarget.toFixed(2) : "(not specified)"}
Output language for reasoning / explanations: ${outputLanguageLabel(input.outputLanguage)}
Today's date: ${todayIso()}

=== AGGREGATE STATS ===
${JSON.stringify(stats, null, 2)}

=== TOP 10 BY SPEND (highest spend, regardless of return) ===
${JSON.stringify(topPerformers.map(compactRow), null, 2)}

=== BOTTOM 10 BY CPA (highest cost per acquisition — likely waste) ===
${JSON.stringify(bottomPerformers.map(compactRow), null, 2)}

=== ALL ${fullSampleRows.length} ROWS (compact) ===
${JSON.stringify(fullSampleRows.map(compactRow), null, 2)}

=== REQUIREMENTS ===
1. executiveSummary: 3-5 sentences. State the headline finding + biggest leverage point.
2. whatWorking: 3-6 patterns observed in winning rows. Each must reference >=2 specific rows as evidence.
3. whatWasting: list every campaign/ad-set burning money relative to the goal. Each entry needs spendEur, reason, recommendedAction.
4. hypotheses: EXACTLY 3 testable A/B experiments for next week. Each needs variantA, variantB, sampleSizeNeeded (#impressions or #clicks), decisionCriteria, expectedImpact.
5. budgetReallocation: array of moves where amounts SUM TO 0 across the array (money is shifted, not added). Use exact campaign/ad-set names.
6. risks: things the analyst is uncertain about — small samples, attribution windows, seasonality. 2-5 items.

=== OUTPUT JSON SHAPE ===
{
  "executiveSummary": "string (3-5 sentences in output language)",
  "whatWorking": [
    {
      "pattern": "string (in output language)",
      "evidence": ["campaign / ad-set / ad name from data"],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "whatWasting": [
    {
      "campaignName": "string (verbatim from data)",
      "adSetName": "string | null",
      "spendEur": number,
      "reason": "string (in output language, explain WHY this is wasting)",
      "recommendedAction": "string (in output language, e.g. 'pause' / 'reduce budget by 50%' / 'rewrite creative')"
    }
  ],
  "hypotheses": [
    {
      "name": "string (short title in output language)",
      "hypothesis": "string (full sentence in output language)",
      "variantA": "string (control, in output language)",
      "variantB": "string (treatment, in output language)",
      "sampleSizeNeeded": "string (e.g. '5000 impressions / variant' or '100 clicks each')",
      "decisionCriteria": "string (e.g. 'CTR uplift >0.5% with p<0.10')",
      "expectedImpact": "string (in output language, quantitative if possible)"
    }
  ],
  "budgetReallocation": [
    {
      "from": "string (campaign or ad-set name, verbatim)",
      "to": "string (campaign or ad-set name, verbatim)",
      "amountEur": number,
      "reason": "string (in output language)"
    }
  ],
  "risks": ["string (in output language)"]
}

Return JSON only.`;
}
