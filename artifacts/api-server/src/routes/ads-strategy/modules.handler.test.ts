/**
 * Smoke tests for the module-endpoint handlers.
 *
 * Phase 2 ships M1+M2 with real AI calls + 7-day cache layer — for unit
 * tests we mock the service layer and DB so no token is spent and tests
 * run offline.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mocks must be set up BEFORE the router import ────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("../../services/ads-strategy/audience.service", () => ({
  generateAudience: vi.fn(),
  AUDIENCE_MODEL: "claude-haiku-4-5-20251001",
}));

vi.mock("../../services/ads-strategy/keywords.service", () => ({
  generateKeywords: vi.fn(),
  KEYWORDS_MODEL: "gemini-2.5-flash",
}));

vi.mock("../../services/ads-strategy/performance.service", async () => {
  const actual = await vi.importActual<
    typeof import("../../services/ads-strategy/performance.service")
  >("../../services/ads-strategy/performance.service");
  return {
    ...actual,
    analyzePerformance: vi.fn(),
    PERFORMANCE_MODEL: "claude-sonnet-4-5-20250929",
  };
});

vi.mock("../../services/ads-strategy/trend.service", () => ({
  getTrendPulse: vi.fn(),
  TREND_MODEL: "grok-3-latest",
}));

import modulesRouter from "./modules.handler";
import { db } from "@workspace/db";
import { generateAudience } from "../../services/ads-strategy/audience.service";
import { generateKeywords } from "../../services/ads-strategy/keywords.service";
import { analyzePerformance } from "../../services/ads-strategy/performance.service";
import { getTrendPulse } from "../../services/ads-strategy/trend.service";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/ads-strategy", modulesRouter);
  return app;
}

const fakeBrand = {
  id: 1,
  brandName: "Test",
  industry: "Beauty",
  branchLocation: "Kempten",
  targetAudience: "Women",
  brandVoice: "Sang trọng",
  updatedAt: new Date("2026-04-30T00:00:00Z"),
};

/**
 * Set up two sequential `db.select()` chains:
 *   1. Brand lookup    — `db.select().from(brandsTable).where(...)` → [brand]
 *   2. Cache lookup    — `db.select().from(adsReportsTable).where(...).orderBy(...).limit(1)` → [cachedReport] | []
 *
 * Order matches the handler call sequence (loadBrand → findCachedReport).
 */
function mockSelectChains(brand: unknown, cachedReport: unknown = null) {
  // Brand chain (2-deep: from → where, awaited)
  const brandWhereResult = brand ? [brand] : [];
  const brandWhere = vi.fn(() => Promise.resolve(brandWhereResult));
  const brandFrom = vi.fn(() => ({ where: brandWhere }));

  // Cache chain (4-deep: from → where → orderBy → limit, awaited)
  const cacheLimitResult = cachedReport ? [cachedReport] : [];
  const cacheLimit = vi.fn(() => Promise.resolve(cacheLimitResult));
  const cacheOrderBy = vi.fn(() => ({ limit: cacheLimit }));
  const cacheWhere = vi.fn(() => ({ orderBy: cacheOrderBy }));
  const cacheFrom = vi.fn(() => ({ where: cacheWhere }));

  let callCount = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    callCount += 1;
    if (callCount === 1) return { from: brandFrom };
    return { from: cacheFrom };
  });
}

function mockReportInsert(saved: unknown) {
  const returning = vi.fn().mockResolvedValue([saved]);
  const values = vi.fn().mockReturnValue({ returning });
  (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ads-strategy module endpoints", () => {
  describe("input validation", () => {
    const app = makeApp();

    it.each([
      ["audience", { brandId: 1 }],
      ["audience", { brandId: 1, service: "x", campaignGoal: "BAD" }],
      ["keywords", { brandId: "not-a-number", service: "Gel-Nails" }],
      ["keywords", {}],
    ])("POST /%s rejects bad payload with 400", async (path, body) => {
      const res = await request(app)
        .post(`/ads-strategy/${path}`)
        .send(body);
      expect(res.status).toBe(400);
    });
  });

  describe("M1 audience", () => {
    it("404 when brand not found", async () => {
      mockSelectChains(null);
      const res = await request(makeApp())
        .post("/ads-strategy/audience")
        .send({
          brandId: 999,
          service: "Gel-Nails Sommer 2026",
          campaignGoal: "awareness",
        });
      expect(res.status).toBe(404);
    });

    it("happy path (cache MISS) calls AI and persists", async () => {
      mockSelectChains(fakeBrand, null); // brand found, no cached report
      (generateAudience as ReturnType<typeof vi.fn>).mockResolvedValue({
        output: { personas: [], metaTargeting: [], googleTargeting: [], negativeAudiences: [], budgetSplit: [], nextSteps: ["x"] },
        aiProvider: "anthropic",
        aiModel: "claude-haiku-4-5-20251001",
        tokensInput: 1000,
        tokensOutput: 1500,
        costEur: "0.0163",
        latencyMs: 2400,
        promptVersion: "1.0.0",
      });
      mockReportInsert({
        id: 42,
        brandId: 1,
        module: "audience",
        aiModel: "claude-haiku-4-5-20251001",
      });

      const res = await request(makeApp())
        .post("/ads-strategy/audience")
        .send({
          brandId: 1,
          service: "Gel-Nails Sommer 2026",
          campaignGoal: "awareness",
          budgetEur: 300,
        });

      expect(res.status).toBe(200);
      expect(res.headers["x-cache"]).toBe("MISS");
      expect(res.body).toMatchObject({ id: 42, module: "audience" });
      expect(generateAudience).toHaveBeenCalledOnce();
    });

    it("cache HIT skips AI call and returns the cached report", async () => {
      const cachedReport = {
        id: 99,
        brandId: 1,
        module: "audience",
        aiModel: "claude-haiku-4-5-20251001",
        costEur: "0.0163",
        latencyMs: 2400,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      };
      mockSelectChains(fakeBrand, cachedReport);

      const res = await request(makeApp())
        .post("/ads-strategy/audience")
        .send({
          brandId: 1,
          service: "Gel-Nails Sommer 2026",
          campaignGoal: "awareness",
          budgetEur: 300,
        });

      expect(res.status).toBe(200);
      expect(res.headers["x-cache"]).toBe("HIT");
      expect(res.body).toMatchObject({ id: 99, module: "audience" });
      expect(generateAudience).not.toHaveBeenCalled();
    });

    it("bypassCache=true forces fresh AI call even when cache exists", async () => {
      // Even though cached report would match, we set bypassCache → handler
      // shouldn't call findCachedReport at all, only loadBrand. So we set
      // up only the brand chain; the cache chain shouldn't be consumed.
      const brandWhere = vi.fn().mockResolvedValue([fakeBrand]);
      const brandFrom = vi.fn().mockReturnValue({ where: brandWhere });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: brandFrom });

      (generateAudience as ReturnType<typeof vi.fn>).mockResolvedValue({
        output: { personas: [], metaTargeting: [], googleTargeting: [], negativeAudiences: [], budgetSplit: [], nextSteps: ["x"] },
        aiProvider: "anthropic",
        aiModel: "claude-haiku-4-5-20251001",
        tokensInput: 1000,
        tokensOutput: 1500,
        costEur: "0.0163",
        latencyMs: 2400,
        promptVersion: "1.0.0",
      });
      mockReportInsert({ id: 200, brandId: 1, module: "audience" });

      const res = await request(makeApp())
        .post("/ads-strategy/audience")
        .send({
          brandId: 1,
          service: "Gel-Nails Sommer 2026",
          campaignGoal: "awareness",
          bypassCache: true,
        });

      expect(res.status).toBe(200);
      expect(res.headers["x-cache"]).toBe("MISS");
      expect(generateAudience).toHaveBeenCalledOnce();
    });
  });

  describe("M2 keywords", () => {
    it("happy path (cache MISS) persists", async () => {
      mockSelectChains(fakeBrand, null);
      (generateKeywords as ReturnType<typeof vi.fn>).mockResolvedValue({
        output: { moneyKeywords: [{ text: "x", intentScore: 9, estimatedVolume: "Medium", estimatedCpcEur: "0", matchTypeRecommended: "exact", useCaseNote: "y" }], discoveryKeywords: [], defensiveKeywords: [], longTailBooking: [], warnings: [], verificationChecklist: ["check"] },
        aiProvider: "google",
        aiModel: "gemini-2.5-flash",
        tokensInput: 600,
        tokensOutput: 900,
        costEur: "0.0007",
        latencyMs: 1500,
        promptVersion: "1.0.0",
      });
      mockReportInsert({ id: 43, brandId: 1, module: "keyword" });

      const res = await request(makeApp())
        .post("/ads-strategy/keywords")
        .send({ brandId: 1, service: "Gel-Nails" });

      expect(res.status).toBe(200);
      expect(res.headers["x-cache"]).toBe("MISS");
      expect(res.body).toMatchObject({ id: 43, module: "keyword" });
    });

    it("cache HIT skips Gemini call", async () => {
      mockSelectChains(fakeBrand, {
        id: 88,
        brandId: 1,
        module: "keyword",
        aiModel: "gemini-2.5-flash",
        createdAt: new Date(),
      });

      const res = await request(makeApp())
        .post("/ads-strategy/keywords")
        .send({ brandId: 1, service: "Gel-Nails" });

      expect(res.status).toBe(200);
      expect(res.headers["x-cache"]).toBe("HIT");
      expect(generateKeywords).not.toHaveBeenCalled();
    });
  });

  describe("M3 performance", () => {
    const validBody = {
      brandId: 1,
      csvData: "Campaign,Ad set name,Amount spent,Impressions\n" +
               "Test,AS1,100.00,5000\nTest,AS2,200.00,10000\n",
      goal: { cplTargetEur: 8 },
    };

    it("rejects bad payload with 400", async () => {
      const res = await request(makeApp())
        .post("/ads-strategy/performance")
        .send({ brandId: 1 }); // missing csvData
      expect(res.status).toBe(400);
    });

    it("rejects oversized CSV (Zod limit 10MB OR express limit, both signal failure)", async () => {
      // The real app uses express.json({ limit: "50mb" }) so payloads up to
      // 50MB reach our Zod validator, which rejects >10MB with 400. The test
      // app uses default express.json() (100KB limit) so a 12MB CSV is
      // already rejected at the body parser with 413. Either response
      // satisfies the requirement: oversized CSVs do not reach the AI.
      const huge = "Campaign,Cost\n" + "X,1\n".repeat(3_000_000); // ~12MB
      const res = await request(makeApp())
        .post("/ads-strategy/performance")
        .send({ brandId: 1, csvData: huge });
      expect([400, 413]).toContain(res.status);
    });

    it("404 when brand not found", async () => {
      mockSelectChains(null);
      const res = await request(makeApp())
        .post("/ads-strategy/performance")
        .send(validBody);
      expect(res.status).toBe(404);
    });

    it("happy path (cache MISS) calls Sonnet and persists", async () => {
      mockSelectChains(fakeBrand, null);
      (analyzePerformance as ReturnType<typeof vi.fn>).mockResolvedValue({
        output: {
          executiveSummary: "Spending €300, biggest leverage is shifting from AS1 to AS2.",
          whatWorking: [],
          whatWasting: [],
          hypotheses: [
            {
              name: "h1",
              hypothesis: "x",
              variantA: "a",
              variantB: "b",
              sampleSizeNeeded: "5000 impressions",
              decisionCriteria: "CTR uplift >0.5%",
              expectedImpact: "10% CTR lift",
            },
          ],
          budgetReallocation: [],
          risks: ["Small sample"],
        },
        aiProvider: "anthropic",
        aiModel: "claude-sonnet-4-5-20250929",
        tokensInput: 7800,
        tokensOutput: 2900,
        costEur: "0.0623",
        latencyMs: 8200,
        promptVersion: "1.0.0",
        detectedPlatform: "meta",
        parsedStats: { rowCount: 2, totalSpendEur: 300, totalConversions: 0 },
      });
      mockReportInsert({
        id: 50,
        brandId: 1,
        module: "performance",
        aiModel: "claude-sonnet-4-5-20250929",
      });

      const res = await request(makeApp())
        .post("/ads-strategy/performance")
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.headers["x-cache"]).toBe("MISS");
      expect(res.body).toMatchObject({ id: 50, module: "performance" });
      expect(analyzePerformance).toHaveBeenCalledOnce();
    });

    it("returns 400 with hint when CSV is malformed", async () => {
      mockSelectChains(fakeBrand, null);
      (analyzePerformance as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          // Re-import inline so we use the real CsvParseError class
          const { CsvParseError } = await import(
            "../../services/ads-strategy/performance.service"
          );
          throw new CsvParseError(
            "Could not detect platform",
            "Expected Meta or Google headers.",
          );
        },
      );

      const res = await request(makeApp())
        .post("/ads-strategy/performance")
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/CSV không hợp lệ/);
      expect(res.body.hint).toMatch(/Expected Meta or Google/);
    });
  });

  describe("M4 trend pulse", () => {
    const validBody = { brandId: 1, regionFocus: "Bayern" };

    it("rejects missing regionFocus with 400", async () => {
      const res = await request(makeApp())
        .post("/ads-strategy/trend")
        .send({ brandId: 1 });
      expect(res.status).toBe(400);
    });

    it("404 when brand not found", async () => {
      mockSelectChains(null);
      const res = await request(makeApp())
        .post("/ads-strategy/trend")
        .send(validBody);
      expect(res.status).toBe(404);
    });

    it("happy path (cache MISS) calls Grok and persists", async () => {
      mockSelectChains(fakeBrand, null);
      (getTrendPulse as ReturnType<typeof vi.fn>).mockResolvedValue({
        output: {
          trends: [
            {
              topic: "Glazed Donut Nails 2026",
              description: "Trending nail aesthetic from Hailey Bieber...",
              relevanceScore: 9,
              momentum: "rising",
              estimatedWindowDays: 21,
              suggestedAngle: "Reel Before/After mit Glazed Finish",
              suggestedKeywords: ["glazed nails", "donut nails 2026"],
              sources: ["https://x.com/example/status/123"],
            },
          ],
          regionalSignals: { bayernSpecific: ["Frühlingsfest München"], germanyWide: [] },
          risksToAvoid: [],
        },
        aiProvider: "xai",
        aiModel: "grok-3-latest",
        tokensInput: 2100,
        tokensOutput: 1850,
        costEur: "0.0218",
        latencyMs: 4500,
        promptVersion: "1.0.0",
        citations: ["https://x.com/example/status/123"],
      });
      mockReportInsert({
        id: 99,
        brandId: 1,
        module: "trend",
        aiModel: "grok-3-latest",
      });

      const res = await request(makeApp())
        .post("/ads-strategy/trend")
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.headers["x-cache"]).toBe("MISS");
      expect(res.body).toMatchObject({ id: 99, module: "trend" });
      expect(getTrendPulse).toHaveBeenCalledOnce();
    });

    it("cache HIT skips Grok call", async () => {
      mockSelectChains(fakeBrand, {
        id: 100,
        brandId: 1,
        module: "trend",
        aiModel: "grok-3-latest",
        createdAt: new Date(),
      });

      const res = await request(makeApp())
        .post("/ads-strategy/trend")
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.headers["x-cache"]).toBe("HIT");
      expect(getTrendPulse).not.toHaveBeenCalled();
    });
  });
});
