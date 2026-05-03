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
import {
  analyzePerformance,
  CsvParseError,
} from "../../services/ads-strategy/performance.service";
import { AUDIENCE_PROMPT_VERSION } from "../../services/ads-strategy/prompts/audience.prompt";
import { KEYWORDS_PROMPT_VERSION } from "../../services/ads-strategy/prompts/keywords.prompt";
import { PERFORMANCE_PROMPT_VERSION } from "../../services/ads-strategy/prompts/performance.prompt";
import { buildCacheKey, findCachedReport, CACHE_TTL_DAYS } from "../../services/ads-strategy/cache";
import { createHash } from "node:crypto";

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
  /** Pass true to skip the 7-day cache lookup and force a fresh AI call. */
  bypassCache: z.boolean().optional().default(false),
});

const keywordsInputSchema = z.object({
  brandId: z.number().int().positive(),
  service: z.string().min(3).max(500),
  competitors: z.array(z.string()).max(20).optional().default([]),
  outputLanguage: z.enum(["de", "vi", "en"]).default("de"),
  bypassCache: z.boolean().optional().default(false),
});

// Tightly bounded — Meta exports for ~1y of campaigns are ≤2MB. We accept up
// to 10MB to be safe; bigger files almost always mean the user uploaded the
// wrong thing (e.g. a database dump).
const MAX_CSV_BYTES = 10 * 1024 * 1024;

const performanceInputSchema = z.object({
  brandId: z.number().int().positive(),
  // platform is informational only — the parser auto-detects it
  platform: z.enum(["meta", "google", "mixed"]).optional(),
  csvData: z
    .string()
    .min(20, "CSV is too short to contain useful data")
    .refine(
      (s) => Buffer.byteLength(s, "utf8") <= MAX_CSV_BYTES,
      `CSV exceeds ${MAX_CSV_BYTES / 1024 / 1024}MB limit`,
    ),
  goal: z
    .object({
      cplTargetEur: z.number().positive().nullable().optional(),
      avgTicketEur: z.number().positive().nullable().optional(),
      roasTarget: z.number().positive().nullable().optional(),
    })
    .optional()
    .default({}),
  outputLanguage: z.enum(["de", "vi", "en"]).default("de"),
  bypassCache: z.boolean().optional().default(false),
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

    // Cache key: anything that affects the prompt or output goes in here.
    // bypassCache itself is excluded so toggling it doesn't change the key.
    const { bypassCache, ...formInput } = input;
    const cacheKey = buildCacheKey({
      brandId: brand.id,
      brand,
      module: "audience",
      promptVersion: AUDIENCE_PROMPT_VERSION,
      formInput,
    });

    if (!bypassCache) {
      const cached = await findCachedReport(brand.id, "audience", cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Cache-Age-Days", String(CACHE_TTL_DAYS));
        return res.json(cached);
      }
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
          ...formInput,
          meta: { promptVersion: result.promptVersion, cacheKey },
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

    res.setHeader("X-Cache", "MISS");
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

    const { bypassCache, ...formInput } = input;
    const cacheKey = buildCacheKey({
      brandId: brand.id,
      brand,
      module: "keyword",
      promptVersion: KEYWORDS_PROMPT_VERSION,
      formInput,
    });

    if (!bypassCache) {
      const cached = await findCachedReport(brand.id, "keyword", cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Cache-Age-Days", String(CACHE_TTL_DAYS));
        return res.json(cached);
      }
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
          ...formInput,
          meta: { promptVersion: result.promptVersion, cacheKey },
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

    res.setHeader("X-Cache", "MISS");
    return res.json(saved);
  } catch (err) {
    return handleError(res, err, "keywords");
  }
});

// ── M3 — Performance Reality (Claude Sonnet 4.5) ─────────────────────────────
router.post("/performance", async (req, res) => {
  try {
    const input = performanceInputSchema.parse(req.body);
    const brand = await loadBrand(input.brandId);
    if (!brand) {
      return res.status(404).json({ error: `Brand ${input.brandId} not found` });
    }

    // For M3 we don't put the raw CSV string in the cache key (it would make
    // the key huge and uncacheable across whitespace tweaks). Instead we hash
    // the CSV separately and use a compact summary in formInput.
    const csvHash = createHash("sha256")
      .update(input.csvData)
      .digest("hex")
      .slice(0, 16);
    const { bypassCache, csvData: _csv, ...rest } = input;
    const formInput = { ...rest, csvHash };

    const cacheKey = buildCacheKey({
      brandId: brand.id,
      brand,
      module: "performance",
      promptVersion: PERFORMANCE_PROMPT_VERSION,
      formInput,
    });

    if (!bypassCache) {
      const cached = await findCachedReport(brand.id, "performance", cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Cache-Age-Days", String(CACHE_TTL_DAYS));
        return res.json(cached);
      }
    }

    let result;
    try {
      result = await analyzePerformance(
        {
          csvData: input.csvData,
          goal: {
            cplTargetEur: input.goal.cplTargetEur ?? null,
            avgTicketEur:
              input.goal.avgTicketEur ??
              (brand.avgTicketSizeEur
                ? parseFloat(brand.avgTicketSizeEur)
                : null),
            roasTarget: input.goal.roasTarget ?? null,
          },
          outputLanguage: input.outputLanguage,
        },
        brand,
      );
    } catch (e) {
      if (e instanceof CsvParseError) {
        return res.status(400).json({
          error: `CSV không hợp lệ: ${e.message}`,
          hint: e.hint,
        });
      }
      throw e;
    }

    const [saved] = await db
      .insert(adsReportsTable)
      .values({
        brandId: input.brandId,
        module: "performance",
        // Persist the parsed summary, NOT the full CSV (CSVs can be huge and
        // we already have everything we need from the parser).
        input: {
          ...formInput,
          detectedPlatform: result.detectedPlatform,
          parsedStats: result.parsedStats,
          meta: { promptVersion: result.promptVersion, cacheKey },
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

    res.setHeader("X-Cache", "MISS");
    return res.json(saved);
  } catch (err) {
    return handleError(res, err, "performance");
  }
});

// ── M4 still stub ────────────────────────────────────────────────────────────
router.post("/trend", notImplemented("trend"));

export default router;
