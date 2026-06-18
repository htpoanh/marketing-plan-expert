import { describe, it, expect } from "vitest";
import { buildInsights, startOfIsoWeek, isoWeekNumber } from "./generator.service";
import type { WeeklyKpi, WeeklySections } from "@workspace/db/schema";

const baseSections: WeeklySections = {
  replyStats: {},
  topTrends: [],
  pendingStrategy: [],
  marketSignals: [],
  insights: [],
};

describe("buildInsights", () => {
  it("emits a danger card when reviews are escalated", () => {
    const kpi: WeeklyKpi = {
      reviewsAutoReplied: 0,
      reviewsEscalated: 3,
      commentsHandled: 0,
      trendsProposed: 0,
      strategyItemsPending: 0,
      marketSignals: 1,
    };
    const out = buildInsights(kpi, baseSections);
    expect(out.some((i) => i.kind === "danger")).toBe(true);
  });

  it("flags a high-score trend as info", () => {
    const kpi: WeeklyKpi = {
      reviewsAutoReplied: 5,
      reviewsEscalated: 0,
      commentsHandled: 0,
      trendsProposed: 1,
      strategyItemsPending: 0,
      marketSignals: 1,
    };
    const sections = { ...baseSections, topTrends: [{ brandId: 1, trendName: "Sommer", score: 80 }] };
    const out = buildInsights(kpi, sections);
    expect(out.some((i) => i.title.includes("Sommer"))).toBe(true);
  });

  it("warns when there are no market signals", () => {
    const kpi: WeeklyKpi = {
      reviewsAutoReplied: 0,
      reviewsEscalated: 0,
      commentsHandled: 0,
      trendsProposed: 0,
      strategyItemsPending: 0,
      marketSignals: 0,
    };
    const out = buildInsights(kpi, baseSections);
    expect(out.some((i) => i.title.includes("Keine frischen Marktsignale"))).toBe(true);
  });
});

describe("week math", () => {
  it("startOfIsoWeek returns a Monday", () => {
    // 2026-06-03 is a Wednesday → Monday is 2026-06-01
    const mon = startOfIsoWeek(new Date("2026-06-03T12:00:00"));
    expect(mon.getDay()).toBe(1);
  });
  it("isoWeekNumber is within 1..53", () => {
    const w = isoWeekNumber(new Date("2026-06-03"));
    expect(w).toBeGreaterThanOrEqual(1);
    expect(w).toBeLessThanOrEqual(53);
  });
});
