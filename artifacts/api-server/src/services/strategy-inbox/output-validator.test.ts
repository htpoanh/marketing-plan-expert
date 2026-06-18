import { describe, it, expect } from "vitest";
import { strategyAnalysisSchema } from "./output-validator";

const valid = {
  summary: "Gute Idee mit kleinem Budget.",
  feasibility: { rating: "high", rationale: "geringe Kosten" },
  timeline: "KW 24, 2 Wochen",
  resources: ["1 Video", "30€ Ads"],
  risks: ["Wetterabhängig"],
  recommendedWeek: "KW 24",
  alignsWithTrends: null,
};

describe("strategyAnalysisSchema", () => {
  it("accepts a valid analysis", () => {
    expect(() => strategyAnalysisSchema.parse(valid)).not.toThrow();
  });

  it("defaults resources/risks to [] when missing", () => {
    const parsed = strategyAnalysisSchema.parse({
      summary: "x",
      feasibility: { rating: "medium", rationale: "y" },
      timeline: "t",
      recommendedWeek: "Backlog",
    });
    expect(parsed.resources).toEqual([]);
    expect(parsed.risks).toEqual([]);
  });

  it("allows extra creative fields (passthrough)", () => {
    const parsed = strategyAnalysisSchema.parse({ ...valid, extraIdea: "bonus" }) as Record<string, unknown>;
    expect(parsed.extraIdea).toBe("bonus");
  });

  it("rejects an invalid feasibility rating", () => {
    expect(() =>
      strategyAnalysisSchema.parse({ ...valid, feasibility: { rating: "maybe", rationale: "z" } }),
    ).toThrow();
  });

  it("rejects when summary is missing", () => {
    const { summary, ...rest } = valid;
    void summary;
    expect(() => strategyAnalysisSchema.parse(rest)).toThrow();
  });
});
