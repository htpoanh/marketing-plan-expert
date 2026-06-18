import { describe, it, expect } from "vitest";
import {
  computeTrendScore,
  scoreBucket,
  bucketToStatus,
  momentumToStrength,
  windowToDifficulty,
  computeStrategyAlignment,
} from "./scoring";

describe("computeTrendScore", () => {
  it("applies strength×relevance×alignment÷difficulty", () => {
    expect(computeTrendScore({ trendStrength: 9, relevance: 8, strategyAlignment: 5, productionDifficulty: 4 })).toBe(90);
    expect(computeTrendScore({ trendStrength: 5, relevance: 5, strategyAlignment: 5, productionDifficulty: 5 })).toBe(25);
  });
  it("clamps factors into 1-10", () => {
    expect(computeTrendScore({ trendStrength: 100, relevance: 100, strategyAlignment: 100, productionDifficulty: 0 })).toBe(1000);
  });
});

describe("scoreBucket", () => {
  it("buckets per v3.0 thresholds", () => {
    expect(scoreBucket(60)).toBe("propose_now");
    expect(scoreBucket(50)).toBe("backlog"); // >50 is propose, 50 is backlog
    expect(scoreBucket(30)).toBe("backlog");
    expect(scoreBucket(29.9)).toBe("skip");
  });
});

describe("bucketToStatus", () => {
  it("maps buckets to insight statuses", () => {
    expect(bucketToStatus("propose_now")).toBe("proposed");
    expect(bucketToStatus("backlog")).toBe("backlog");
    expect(bucketToStatus("skip")).toBe("skipped");
  });
});

describe("momentumToStrength", () => {
  it("peak > rising > declining", () => {
    expect(momentumToStrength("peak")).toBeGreaterThan(momentumToStrength("rising"));
    expect(momentumToStrength("rising")).toBeGreaterThan(momentumToStrength("declining"));
  });
});

describe("windowToDifficulty", () => {
  it("shorter window is harder", () => {
    expect(windowToDifficulty(2)).toBeGreaterThan(windowToDifficulty(10));
    expect(windowToDifficulty(30)).toBe(3);
  });
});

describe("computeStrategyAlignment", () => {
  it("returns neutral 5 when no strategy items", () => {
    expect(computeStrategyAlignment("nail trends sommer", [])).toEqual({ score: 5, verdict: "neutral" });
  });
  it("raises score when keywords overlap", () => {
    const r = computeStrategyAlignment("Sommer Nageldesign Aktion", ["Wir wollen eine Sommer Aktion für Nageldesign"]);
    expect(r.verdict).toBe("align");
    expect(r.score).toBeGreaterThan(5);
  });
  it("low-ish when no overlap", () => {
    const r = computeStrategyAlignment("Fußball WM Kantine", ["Nageldesign Sommer"]);
    expect(r.verdict).toBe("neutral");
    expect(r.score).toBeLessThanOrEqual(5);
  });
});
