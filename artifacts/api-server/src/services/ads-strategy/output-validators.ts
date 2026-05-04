/**
 * Zod schemas that validate the JSON returned by the AI providers.
 *
 * If the model returns malformed JSON or misses required fields, validation
 * fails and the handler retries / surfaces an error rather than persisting
 * garbage. We are intentionally lenient — extra fields are allowed (`.passthrough()`)
 * so a model with new ideas isn't rejected for being creative.
 */
import { z } from "zod";

// ── M1 audience ──────────────────────────────────────────────────────────────

const personaSchema = z
  .object({
    rank: z.number().int().min(1).max(10),
    name: z.string().min(1),
    age: z.number().int().min(13).max(99),
    profession: z.string(),
    locationDetail: z.string(),
    demographics: z
      .object({
        gender: z.enum(["male", "female", "diverse"]),
        familyStatus: z.string(),
        incomeBracket: z.string(),
        education: z.string().nullable(),
      })
      .passthrough(),
    psychographics: z
      .object({
        values: z.array(z.string()),
        aspirations: z.array(z.string()),
        fears: z.array(z.string()),
      })
      .passthrough(),
    onlineBehavior: z
      .object({
        platforms: z.array(z.string()),
        activeHours: z.string(),
        follows: z.array(z.string()),
        consumptionPattern: z.string(),
      })
      .passthrough(),
    painPoints: z.array(z.string()),
    buyingTriggers: z.array(z.string()),
    budgetPerPurchase: z.string(),
    estimatedAudienceSize: z
      .string()
      .refine((s) => /ESTIMATE|Schätzung/i.test(s), {
        message: "Must contain ESTIMATE or Schätzung marker",
      }),
  })
  .passthrough();

const metaTargetingSchema = z
  .object({
    personaRank: z.number().int().min(1).max(10),
    adSetName: z.string(),
    location: z
      .object({
        type: z.enum(["radius", "city", "region"]),
        address: z.string(),
        radiusKm: z.number().optional(),
      })
      .passthrough(),
    ageRange: z.tuple([z.number().int(), z.number().int()]),
    gender: z.enum(["all", "female", "male"]),
    interests: z.array(z.string()),
    behaviors: z.array(z.string()),
    lookalikeSource: z.string().nullable(),
    advantagePlusRecommended: z.boolean(),
  })
  .passthrough();

const googleTargetingSchema = z
  .object({
    personaRank: z.number().int().min(1).max(10),
    campaignType: z.enum(["search", "display", "pmax", "demand_gen"]),
    keywordThemes: z.array(z.string()),
    demographicFilters: z
      .object({
        ageRanges: z.array(z.string()),
        householdIncome: z.string().nullable(),
        parentalStatus: z.string().nullable(),
      })
      .passthrough(),
  })
  .passthrough();

export const audienceOutputSchema = z
  .object({
    personas: z.array(personaSchema).min(1).max(10),
    metaTargeting: z.array(metaTargetingSchema),
    googleTargeting: z.array(googleTargetingSchema),
    negativeAudiences: z.array(
      z.object({ exclude: z.string(), reason: z.string() }).passthrough(),
    ),
    budgetSplit: z.array(
      z
        .object({
          personaRank: z.number().int(),
          percentage: z.number(),
          amountEur: z.number().optional(),
          reason: z.string(),
        })
        .passthrough(),
    ),
    nextSteps: z.array(z.string()).min(1),
  })
  .passthrough();

export type AudienceOutput = z.infer<typeof audienceOutputSchema>;

// ── M2 keywords ──────────────────────────────────────────────────────────────

const keywordSchema = z
  .object({
    text: z.string().min(1),
    intentScore: z.number().int().min(1).max(10),
    estimatedVolume: z.enum(["Low", "Medium", "High"]),
    estimatedCpcEur: z.string(),
    matchTypeRecommended: z.enum(["exact", "phrase", "broad"]),
    useCaseNote: z.string(),
  })
  .passthrough();

export const keywordsOutputSchema = z
  .object({
    moneyKeywords: z.array(keywordSchema).min(1),
    discoveryKeywords: z.array(keywordSchema),
    defensiveKeywords: z.array(keywordSchema),
    longTailBooking: z.array(keywordSchema),
    warnings: z.array(z.string()),
    verificationChecklist: z.array(z.string()).min(1),
  })
  .passthrough();

export type KeywordsOutput = z.infer<typeof keywordsOutputSchema>;

// ── M3 performance ───────────────────────────────────────────────────────────

const whatWorkingSchema = z
  .object({
    pattern: z.string(),
    evidence: z.array(z.string()).min(1),
    confidence: z.enum(["high", "medium", "low"]),
  })
  .passthrough();

const whatWastingSchema = z
  .object({
    campaignName: z.string(),
    adSetName: z.string().nullable().optional(),
    spendEur: z.number(),
    reason: z.string(),
    recommendedAction: z.string(),
  })
  .passthrough();

const hypothesisSchema = z
  .object({
    name: z.string(),
    hypothesis: z.string(),
    variantA: z.string(),
    variantB: z.string(),
    sampleSizeNeeded: z.string(),
    decisionCriteria: z.string(),
    expectedImpact: z.string(),
  })
  .passthrough();

const budgetReallocationSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    amountEur: z.number(),
    reason: z.string(),
  })
  .passthrough();

export const performanceOutputSchema = z
  .object({
    executiveSummary: z.string().min(20),
    whatWorking: z.array(whatWorkingSchema),
    whatWasting: z.array(whatWastingSchema),
    /**
     * Sonnet is asked for EXACTLY 3 hypotheses but we accept 1-5 to absorb
     * minor model deviation without rejecting the whole report.
     */
    hypotheses: z.array(hypothesisSchema).min(1).max(5),
    budgetReallocation: z.array(budgetReallocationSchema),
    risks: z.array(z.string()),
  })
  .passthrough();

export type PerformanceOutput = z.infer<typeof performanceOutputSchema>;

// ── M4 trend pulse ───────────────────────────────────────────────────────────

const trendItemSchema = z
  .object({
    topic: z.string().min(1),
    description: z.string().min(10),
    relevanceScore: z.number().min(1).max(10),
    momentum: z.enum(["rising", "peak", "declining"]),
    estimatedWindowDays: z.number().int().min(1).max(180),
    suggestedAngle: z.string(),
    suggestedKeywords: z.array(z.string()),
    sources: z.array(z.string()).min(1),
  })
  .passthrough();

export const trendOutputSchema = z
  .object({
    trends: z.array(trendItemSchema).min(1).max(15),
    regionalSignals: z
      .object({
        bayernSpecific: z.array(z.string()),
        germanyWide: z.array(z.string()),
      })
      .passthrough(),
    risksToAvoid: z.array(z.string()),
  })
  .passthrough();

export type TrendOutput = z.infer<typeof trendOutputSchema>;
