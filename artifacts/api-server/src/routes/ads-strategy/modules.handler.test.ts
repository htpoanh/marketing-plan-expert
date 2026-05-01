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

import modulesRouter from "./modules.handler";
import { db } from "@workspace/db";
import { generateAudience } from "../../services/ads-strategy/audience.service";
import { generateKeywords } from "../../services/ads-strategy/keywords.service";

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

  describe("M3 + M4 still stubs", () => {
    it.each([["performance"], ["trend"]])(
      "POST /%s returns 501",
      async (path) => {
        const res = await request(makeApp())
          .post(`/ads-strategy/${path}`)
          .send({});
        expect(res.status).toBe(501);
        expect(res.body.error).toMatch(/Phase [34]/);
      },
    );
  });
});
