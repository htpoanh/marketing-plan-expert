/**
 * Frontend-side type aliases for the Ads Strategy Agent module.
 *
 * The generated client (lib/api-client-react) gives us hook return types,
 * but the actual `output` shape is `Record<string, unknown>` since OpenAPI
 * declares it as `additionalProperties: true`. Here we define the
 * expected structure so result components have proper IntelliSense.
 */

// Re-export the generated Brand type so we share the canonical shape with
// the rest of the frontend.
export type { Brand } from "@workspace/api-client-react";

export type AdsModule = "audience" | "keyword" | "performance" | "trend";

export type AdsReport = {
  id: number;
  brandId: number;
  module: AdsModule;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  aiProvider: string;
  aiModel: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  costEur: string | null;
  latencyMs: number | null;
  userNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── M1 audience output shape ─────────────────────────────────────────────────
export type Persona = {
  rank: number;
  name: string;
  age: number;
  profession: string;
  locationDetail: string;
  demographics?: {
    gender?: string;
    familyStatus?: string;
    incomeBracket?: string;
    education?: string | null;
  };
  psychographics?: {
    values?: string[];
    aspirations?: string[];
    fears?: string[];
  };
  onlineBehavior?: {
    platforms?: string[];
    activeHours?: string;
    follows?: string[];
    consumptionPattern?: string;
  };
  painPoints?: string[];
  buyingTriggers?: string[];
  budgetPerPurchase?: string;
  estimatedAudienceSize?: string;
};

export type MetaTargeting = {
  personaRank: number;
  adSetName: string;
  location: { type: string; address: string; radiusKm?: number };
  ageRange: [number, number];
  gender: "all" | "female" | "male";
  interests: string[];
  behaviors?: string[];
  lookalikeSource?: string | null;
  advantagePlusRecommended?: boolean;
};

export type GoogleTargeting = {
  personaRank: number;
  campaignType: "search" | "display" | "pmax" | "demand_gen";
  keywordThemes: string[];
  demographicFilters?: {
    ageRanges?: string[];
    householdIncome?: string | null;
    parentalStatus?: string | null;
  };
};

export type AudienceOutput = {
  personas: Persona[];
  metaTargeting: MetaTargeting[];
  googleTargeting: GoogleTargeting[];
  negativeAudiences: Array<{ exclude: string; reason: string }>;
  budgetSplit: Array<{
    personaRank: number;
    percentage: number;
    amountEur?: number;
    reason: string;
  }>;
  nextSteps: string[];
};

// ── M2 keywords output shape ─────────────────────────────────────────────────
export type Keyword = {
  text: string;
  intentScore: number;
  estimatedVolume: "Low" | "Medium" | "High";
  estimatedCpcEur: string;
  matchTypeRecommended: "exact" | "phrase" | "broad";
  useCaseNote: string;
};

export type KeywordsOutput = {
  moneyKeywords: Keyword[];
  discoveryKeywords: Keyword[];
  defensiveKeywords: Keyword[];
  longTailBooking: Keyword[];
  warnings: string[];
  verificationChecklist: string[];
};
