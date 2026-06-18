import { describe, it, expect } from "vitest";
import { estimateCostEur, getRateCard } from "./cost-calculator";

describe("estimateCostEur", () => {
  it("returns null when both token counts are missing/zero", () => {
    expect(estimateCostEur("anthropic", "claude-haiku-4-5-20251001", 0, 0)).toBeNull();
    expect(estimateCostEur("anthropic", "claude-haiku-4-5-20251001", null, null)).toBeNull();
    expect(estimateCostEur("anthropic", "claude-haiku-4-5-20251001", undefined, undefined)).toBeNull();
  });

  it("computes Claude Haiku cost (0.93 in / 4.65 out per 1M)", () => {
    // 1M input + 1M output = 0.93 + 4.65 = 5.58
    expect(estimateCostEur("anthropic", "claude-haiku-4-5-20251001", 1_000_000, 1_000_000))
      .toBe("5.5800");
    // 1k input + 1k output = (0.93 + 4.65) / 1000 = 0.00558
    expect(estimateCostEur("anthropic", "claude-haiku-4-5-20251001", 1_000, 1_000))
      .toBe("0.0056");
  });

  it("computes Gemini Flash cost (0.28 in / 0.56 out per 1M)", () => {
    // 1M + 1M = 0.84
    expect(estimateCostEur("google", "gemini-2.5-flash", 1_000_000, 1_000_000))
      .toBe("0.8400");
  });

  it("falls back to conservative rate for unknown models", () => {
    const result = estimateCostEur("anthropic", "future-mystery-model", 1_000, 1_000);
    expect(result).not.toBeNull();
    // Fallback rate (5 + 15) / 1000 = 0.020
    expect(parseFloat(result!)).toBeCloseTo(0.02, 4);
  });

  it("returns 4-decimal-precision string suitable for the decimal(10,4) column", () => {
    const result = estimateCostEur("google", "gemini-2.5-flash", 600, 900);
    expect(result).toMatch(/^\d+\.\d{4}$/);
  });

  it("includes pricing for every model the audience/keywords services declare", () => {
    const card = getRateCard();
    // Models referenced in services as DEFAULT_*_MODEL — keep this list in sync
    expect(card["claude-haiku-4-5-20251001"]).toBeDefined();
    expect(card["gemini-2.5-flash"]).toBeDefined();
    expect(card["claude-sonnet-4-5-20250929"]).toBeDefined();
    // M4 Trend Pulse now runs on Claude (was Grok).
    expect(card["claude-sonnet-4-6"]).toBeDefined();
  });
});
