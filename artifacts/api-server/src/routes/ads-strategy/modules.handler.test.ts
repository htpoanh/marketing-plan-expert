/**
 * Smoke tests for the Phase 1 module-endpoint stubs.
 *
 * These verify only:
 *   1. The routes are mounted (i.e. nothing crashes at import time)
 *   2. They respond with 501 Not Implemented (Phase 2 will replace these)
 *
 * Once Phase 2 wires up real AI calls, replace these with full integration
 * tests that mock the AI providers and assert the saved `ads_reports` row.
 */
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import modulesRouter from "./modules.handler";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/ads-strategy", modulesRouter);
  return app;
}

describe("ads-strategy module endpoints (Phase 1 stubs)", () => {
  const app = makeApp();

  it.each([
    ["audience"],
    ["keywords"],
    ["performance"],
    ["trend"],
  ])("POST /ads-strategy/%s returns 501 with helpful message", async (path) => {
    const res = await request(app).post(`/ads-strategy/${path}`).send({});
    expect(res.status).toBe(501);
    expect(res.body).toMatchObject({ error: expect.stringContaining("Phase 2") });
  });
});
