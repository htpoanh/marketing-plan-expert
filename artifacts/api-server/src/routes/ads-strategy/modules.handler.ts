/**
 * Module endpoint handlers.
 *
 * Phase 2 (this commit):
 *   ✅ POST /ads-strategy/audience    → Claude Haiku
 *   ✅ POST /ads-strategy/keywords    → Gemini 2.5 Flash
 *   ⏸  POST /ads-strategy/performance → 501 (Phase 3)
 *   ⏸  POST /ads-strategy/trend       → 501 (Phase 4)
 *
 * Each implemented handler:
 *   1. Validates input from req.body (zod from generated schemas)
 *   2. Loads the Brand row (404 if missing)
 *   3. Calls the matching service (audience.service / keywords.service)
 *   4. Persists the result to ads_reports
 *   5. Returns the saved report (frontend reuses the same shape as
 *      list/get endpoints)
 *
 * Errors:
 *   400 — validation failure (input or AI output)
 *   404 — brand not found
 *   502 — AI provider error
 *   500 — anything else
 */
import {
  Router,
  type IRouter,
  type Request,
  type Response,
} from "express";
import { db } from "@workspace/db";
import { brandsTable, adsReportsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z, ZodError } from "zod";

import { generateAudience } from "../../services/ads-strategy/audience.service";
import { generateKeywords } from "../../services/ads-strategy/keywords.service";

const router: IRouter = Router();

// ── Input schemas (mirror OpenAPI request bodies) ─────────────────────────────

const audienceInputSchema = z.object({
  brandId: z.number().int().positive(),
  service: z.string().min(3).max(500),
  campaignGoal: z.enum([
    "awareness",
    "traffic",
    "leads",
    "conversions",
    "retention",
  ]),
  budgetEur: z.number().positive().nullable().optional(),
  outputLanguage: z.enum(["de", "vi", "en"]).default("de"),
});

const keywordsInputSchema = z.object({
  brandId: z.number().int().positive(),
  service: z.string().min(3).max(500),
  competitors: z.array(z.string()).max(20).optional().default([]),
  outputLanguage: z.enum(["de", "vi", "en"]).default("de"),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loadBrand(brandId: number) {
  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(eq(brandsTable.id, brandId));
  return brand ?? null;
}

function handleError(
  res: Response,
  err: unknown,
  context: string,
): Response {
  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ error: `${context} validation failed`, details: err.issues });
  }
  // Anthropic / Google SDK errors typically expose `status` or `code`
  const status = (err as { status?: number })?.status;
  const message = (err as Error)?.message ?? String(err);
  if (status && status >= 400 && status < 500) {
    console.error(`[ads-strategy/${context}] AI client error`, err);
    return res.status(502).json({
      error: `AI provider rejected the request: ${message}`,
    });
  }
  if (status && status >= 500) {
    console.error(`[ads-strategy/${context}] AI upstream 5xx`, err);
    return res.status(502).json({
      error: `AI provider error: ${message}`,
    });
  }
  console.error(`[ads-strategy/${context}] failed`, err);
  return res.status(500).json({ error: `${context} failed: ${message}` });
}

function notImplemented(moduleName: string) {
  return (_req: Request, res: Response) => {
    res.status(501).json({
      error: `Module '${moduleName}' is not yet implemented (Phase ${moduleName === "performance" ? "3" : "4"}). The endpoint and schema exist; the AI integration will be wired up next.`,
    });
  };
}

// ── M1 — Audience ────────────────────────────────────────────────────────────
router.post("/audience", async (req, res) => {
  try {
    const input = audienceInputSchema.parse(req.body);
    const brand = await loadBrand(input.brandId);
    if (!brand) {
      return res.status(404).json({ error: `Brand ${input.brandId} not found` });
    }

    const result = await generateAudience(
      {
        service: input.service,
        campaignGoal: input.campaignGoal,
        budgetEur: input.budgetEur ?? null,
        outputLanguage: input.outputLanguage,
      },
      brand,
    );

    const [saved] = await db
      .insert(adsReportsTable)
      .values({
        brandId: input.brandId,
        module: "audience",
        input: {
          ...input,
          meta: { promptVersion: result.promptVersion },
        },
        output: result.output,
        aiProvider: result.aiProvider,
        aiModel: result.aiModel,
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        costEur: result.costEur,
        latencyMs: result.latencyMs,
      })
      .returning();

    return res.json(saved);
  } catch (err) {
    return handleError(res, err, "audience");
  }
});

// ── M2 — Keywords ────────────────────────────────────────────────────────────
router.post("/keywords", async (req, res) => {
  try {
    const input = keywordsInputSchema.parse(req.body);
    const brand = await loadBrand(input.brandId);
    if (!brand) {
      return res.status(404).json({ error: `Brand ${input.brandId} not found` });
    }

    const result = await generateKeywords(
      {
        service: input.service,
        competitors: input.competitors,
        outputLanguage: input.outputLanguage,
      },
      brand,
    );

    const [saved] = await db
      .insert(adsReportsTable)
      .values({
        brandId: input.brandId,
        module: "keyword",
        input: {
          ...input,
          meta: { promptVersion: result.promptVersion },
        },
        output: result.output,
        aiProvider: result.aiProvider,
        aiModel: result.aiModel,
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        costEur: result.costEur,
        latencyMs: result.latencyMs,
      })
      .returning();

    return res.json(saved);
  } catch (err) {
    return handleError(res, err, "keywords");
  }
});

// ── M3 + M4 still stubs ──────────────────────────────────────────────────────
router.post("/performance", notImplemented("performance"));
router.post("/trend", notImplemented("trend"));

export default router;
