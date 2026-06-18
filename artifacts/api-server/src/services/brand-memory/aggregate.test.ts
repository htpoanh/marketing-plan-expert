import { describe, it, expect } from "vitest";
import { tallyIntents, topTrendAlignments } from "./aggregate.service";

describe("tallyIntents", () => {
  it("counts and sorts intents descending, skipping nulls", () => {
    const result = tallyIntents([
      { intent: "booking" },
      { intent: "price" },
      { intent: "booking" },
      { intent: null },
      { intent: "booking" },
    ]);
    expect(result[0]).toEqual({ intent: "booking", count: 3 });
    expect(result[1]).toEqual({ intent: "price", count: 1 });
    expect(result).toHaveLength(2);
  });

  it("returns empty array for no rows", () => {
    expect(tallyIntents([])).toEqual([]);
  });
});

describe("topTrendAlignments", () => {
  it("parses scores, sorts desc, limits", () => {
    const result = topTrendAlignments(
      [
        { trendName: "A", trendScore: "30.0" },
        { trendName: "B", trendScore: "90.5" },
        { trendName: "C", trendScore: "55.0" },
      ],
      2,
    );
    expect(result).toEqual([
      { trend: "B", score: 90.5 },
      { trend: "C", score: 55 },
    ]);
  });
});
