/**
 * Smoke tests for the module-endpoint handlers.
 *
 * Phase 2 ships M1+M2 with real AI calls — for unit tests we mock the
 * service layer so no token is spent and tests run offline. The tests
 * verify:
 *   - input validation rejects bad requests with 400
 *   - audience + keywords happy paths persist + return a report
 *   - M3/M4 still return 501 with a Phase X message
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
}));

vi.mock("../../services/ads-strategy/keywords.service", () => ({
  generateKeywords: vi.fn(),
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
};

function mockBrandLookup(brand: unknown) {
  // db.select().from().where() — chainable mock returning [brand] or []
  const where = vi.fn().mockResolvedValue(brand ? [brand] : []);
  const from = vi.fn().mockReturnValue({ where });
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from });
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
      mockBrandLookup(null);
      const res = await request(makeApp())
        .post("/ads-strategy/audience")
        .send({
          brandId: 999,
          service: "Gel-Nails Sommer 2026",
          campaignGoal: "awareness",
        });
      expect(res.status).toBe(404);
    });

    it("happy path persists and returns the report", async () => {
      mockBrandLookup(fakeBrand);
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
      expect(res.body).toMatchObject({ id: 42, module: "audience" });
      expect(generateAudience).toHaveBeenCalledOnce();
    });
  });

  describe("M2 keywords", () => {
    it("happy path persists and returns the report", async () => {
      mockBrandLookup(fakeBrand);
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
      expect(res.body).toMatchObject({ id: 43, module: "keyword" });
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
