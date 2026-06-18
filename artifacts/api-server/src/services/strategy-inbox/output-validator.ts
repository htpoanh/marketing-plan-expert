/**
 * Phase B — Zod schema validating Claude's strategy-inbox analysis JSON.
 * Lenient via .passthrough() so a creative model isn't rejected for extra keys.
 */
import { z } from "zod";

export const strategyAnalysisSchema = z
  .object({
    summary: z.string(),
    feasibility: z
      .object({
        rating: z.enum(["high", "medium", "low"]),
        rationale: z.string(),
      })
      .passthrough(),
    timeline: z.string(),
    resources: z.array(z.string()).default([]),
    risks: z.array(z.string()).default([]),
    recommendedWeek: z.string(),
    alignsWithTrends: z.string().nullable().optional(),
  })
  .passthrough();

export type StrategyAnalysisOutput = z.infer<typeof strategyAnalysisSchema>;
