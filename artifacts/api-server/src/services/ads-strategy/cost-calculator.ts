/**
 * Token → € cost estimation for the AI providers we use.
 *
 * All rates are €/1M tokens. Sourced from public 2026-04 pricing pages and
 * converted to EUR at €1 ≈ $1.07. These are approximations — the source of
 * truth is each provider's billing dashboard.
 *
 * When a model is missing from the table we fall back to a conservative
 * "unknown model" rate so we never silently report €0.0000.
 */
import type { AdsAiProvider } from "@workspace/db/schema";

type Rate = { inputPerMillion: number; outputPerMillion: number };

const RATES: Record<string, Rate> = {
  // Anthropic Claude
  "claude-haiku-4-5-20251001": { inputPerMillion: 0.93, outputPerMillion: 4.65 },
  "claude-sonnet-4-5-20250929": { inputPerMillion: 2.79, outputPerMillion: 14.0 },
  "claude-sonnet-4-6": { inputPerMillion: 2.79, outputPerMillion: 14.0 },
  "claude-opus-4-7-20251101": { inputPerMillion: 14.0, outputPerMillion: 70.0 },

  // Google Gemini
  "gemini-2.5-flash": { inputPerMillion: 0.28, outputPerMillion: 0.56 },
  "gemini-2.5-pro": { inputPerMillion: 1.17, outputPerMillion: 4.65 },

  // OpenAI
  "gpt-4o": { inputPerMillion: 2.34, outputPerMillion: 9.35 },
  "gpt-4o-mini": { inputPerMillion: 0.14, outputPerMillion: 0.56 },

  // xAI Grok
  "grok-3": { inputPerMillion: 2.8, outputPerMillion: 14.0 },
  "grok-3-latest": { inputPerMillion: 2.8, outputPerMillion: 14.0 },
};

const FALLBACK_RATE: Rate = { inputPerMillion: 5.0, outputPerMillion: 15.0 };

/**
 * Estimate the EUR cost of a single AI call.
 *
 * Returns a string with 4-decimal precision so it slots straight into the
 * `ads_reports.cost_eur` decimal(10,4) column. Returns null if both token
 * counts are missing (e.g. provider didn't return usage metadata).
 */
export function estimateCostEur(
  _provider: AdsAiProvider,
  model: string,
  tokensInput: number | null | undefined,
  tokensOutput: number | null | undefined,
): string | null {
  if (
    (tokensInput == null || tokensInput === 0) &&
    (tokensOutput == null || tokensOutput === 0)
  ) {
    return null;
  }

  const rate = RATES[model] ?? FALLBACK_RATE;
  const inputCost = ((tokensInput ?? 0) * rate.inputPerMillion) / 1_000_000;
  const outputCost = ((tokensOutput ?? 0) * rate.outputPerMillion) / 1_000_000;
  const total = inputCost + outputCost;
  return total.toFixed(4);
}

/** Exposed for tests + diagnostics. */
export function getRateCard(): Readonly<Record<string, Rate>> {
  return RATES;
}
