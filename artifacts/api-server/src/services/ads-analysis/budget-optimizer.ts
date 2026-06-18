/**
 * Phase A — cross-platform budget optimizer (pure, testable).
 *
 * Given normalized performance rows, rank platforms by ROAS and suggest
 * shifting budget from the worst performer to the best. Works on whatever rows
 * exist (live-pulled or manually entered).
 */

export type PerfInput = {
  platform: string;
  spendEur: number;
  roas: number | null;
};

export type BudgetSuggestion = {
  fromPlatform: string;
  toPlatform: string;
  shiftEur: number;
  reason: string;
};

/**
 * Suggest moving up to `shiftFraction` of the worst platform's spend to the
 * best one, when the ROAS gap is meaningful (best ROAS >= 1.5× worst ROAS).
 * Returns null when there's nothing worth shifting.
 */
export function suggestReallocation(
  rows: PerfInput[],
  shiftFraction = 0.3,
): BudgetSuggestion | null {
  const scored = rows.filter((r) => r.roas != null && r.spendEur > 0) as Array<
    PerfInput & { roas: number }
  >;
  if (scored.length < 2) return null;

  const sorted = [...scored].sort((a, b) => b.roas - a.roas);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  if (best.platform === worst.platform) return null;
  if (worst.roas <= 0) {
    return {
      fromPlatform: worst.platform,
      toPlatform: best.platform,
      shiftEur: Math.round(worst.spendEur * shiftFraction * 100) / 100,
      reason: `${worst.platform} hat ROAS ${worst.roas} (kein Return) — Budget zu ${best.platform} (ROAS ${best.roas}) verschieben.`,
    };
  }
  if (best.roas < worst.roas * 1.5) return null;

  return {
    fromPlatform: worst.platform,
    toPlatform: best.platform,
    shiftEur: Math.round(worst.spendEur * shiftFraction * 100) / 100,
    reason: `${best.platform} ROAS ${best.roas} ist deutlich besser als ${worst.platform} ROAS ${worst.roas} — ${Math.round(shiftFraction * 100)}% Budget verschieben.`,
  };
}

export type CrossPlatformSummary = {
  totalSpendEur: number;
  blendedRoas: number | null;
  bestPlatform: string | null;
  worstPlatform: string | null;
};

export function crossPlatformSummary(rows: PerfInput[]): CrossPlatformSummary {
  const totalSpend = rows.reduce((s, r) => s + (r.spendEur || 0), 0);
  const withRoas = rows.filter((r) => r.roas != null && r.spendEur > 0) as Array<
    PerfInput & { roas: number }
  >;
  if (withRoas.length === 0) {
    return { totalSpendEur: Math.round(totalSpend * 100) / 100, blendedRoas: null, bestPlatform: null, worstPlatform: null };
  }
  // Spend-weighted blended ROAS.
  const blended =
    withRoas.reduce((s, r) => s + r.roas * r.spendEur, 0) /
    withRoas.reduce((s, r) => s + r.spendEur, 0);
  const sorted = [...withRoas].sort((a, b) => b.roas - a.roas);
  return {
    totalSpendEur: Math.round(totalSpend * 100) / 100,
    blendedRoas: Math.round(blended * 100) / 100,
    bestPlatform: sorted[0].platform,
    worstPlatform: sorted[sorted.length - 1].platform,
  };
}
