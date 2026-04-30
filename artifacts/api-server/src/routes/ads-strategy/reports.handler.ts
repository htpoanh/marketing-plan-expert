import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { adsReportsTable, type AdsModule } from "@workspace/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";

const router: IRouter = Router();

const VALID_MODULES: ReadonlyArray<AdsModule> = [
  "audience",
  "keyword",
  "performance",
  "trend",
];

// ── GET /ads-strategy/reports ────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const brandId = req.query.brandId
      ? Number(req.query.brandId)
      : undefined;
    const moduleParam = req.query.module as string | undefined;
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 50, 1),
      200,
    );

    if (moduleParam && !VALID_MODULES.includes(moduleParam as AdsModule)) {
      return res
        .status(400)
        .json({ error: `Invalid module. Must be one of: ${VALID_MODULES.join(", ")}` });
    }

    const conditions = [];
    if (brandId !== undefined && !Number.isNaN(brandId)) {
      conditions.push(eq(adsReportsTable.brandId, brandId));
    }
    if (moduleParam) {
      conditions.push(eq(adsReportsTable.module, moduleParam as AdsModule));
    }

    const reports = await db
      .select()
      .from(adsReportsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adsReportsTable.createdAt))
      .limit(limit);

    return res.json(reports);
  } catch (error) {
    console.error("[ads-strategy/reports] list failed", error);
    return res.status(500).json({ error: "Failed to list ads reports" });
  }
});

// ── GET /ads-strategy/reports/:id ────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [report] = await db
      .select()
      .from(adsReportsTable)
      .where(eq(adsReportsTable.id, id));

    if (!report) return res.status(404).json({ error: "Report not found" });
    return res.json(report);
  } catch (error) {
    console.error("[ads-strategy/reports] get failed", error);
    return res.status(500).json({ error: "Failed to fetch ads report" });
  }
});

// ── PATCH /ads-strategy/reports/:id (user notes only) ────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const userNotes =
      typeof req.body?.userNotes === "string" ? req.body.userNotes : null;

    const [report] = await db
      .update(adsReportsTable)
      .set({ userNotes, updatedAt: new Date() })
      .where(eq(adsReportsTable.id, id))
      .returning();

    if (!report) return res.status(404).json({ error: "Report not found" });
    return res.json(report);
  } catch (error) {
    console.error("[ads-strategy/reports] update failed", error);
    return res.status(500).json({ error: "Failed to update ads report" });
  }
});

// ── DELETE /ads-strategy/reports/:id ─────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [deleted] = await db
      .delete(adsReportsTable)
      .where(eq(adsReportsTable.id, id))
      .returning({ id: adsReportsTable.id });

    if (!deleted) return res.status(404).json({ error: "Report not found" });
    return res.status(204).end();
  } catch (error) {
    console.error("[ads-strategy/reports] delete failed", error);
    return res.status(500).json({ error: "Failed to delete ads report" });
  }
});

export default router;

/**
 * Aggregate token usage + €cost grouped by (provider, model, module).
 * Mounted separately on /cost-summary by the parent router.
 */
export async function costSummaryHandler(
  req: import("express").Request,
  res: import("express").Response,
): Promise<import("express").Response | void> {
  try {
    const brandId = req.query.brandId
      ? Number(req.query.brandId)
      : undefined;
    const sinceParam = req.query.since as string | undefined;
    const now = new Date();
    const defaultSince = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const since = sinceParam ? new Date(sinceParam) : defaultSince;
    if (Number.isNaN(since.getTime())) {
      return res.status(400).json({ error: "Invalid `since` date" });
    }

    const conditions = [gte(adsReportsTable.createdAt, since)];
    if (brandId !== undefined && !Number.isNaN(brandId)) {
      conditions.push(eq(adsReportsTable.brandId, brandId));
    }

    const buckets = await db
      .select({
        aiProvider: adsReportsTable.aiProvider,
        aiModel: adsReportsTable.aiModel,
        module: adsReportsTable.module,
        callCount: sql<number>`count(*)::int`,
        totalTokensInput: sql<number>`coalesce(sum(${adsReportsTable.tokensInput}), 0)::int`,
        totalTokensOutput: sql<number>`coalesce(sum(${adsReportsTable.tokensOutput}), 0)::int`,
        totalCostEur: sql<string>`coalesce(sum(${adsReportsTable.costEur}), 0)::text`,
      })
      .from(adsReportsTable)
      .where(and(...conditions))
      .groupBy(
        adsReportsTable.aiProvider,
        adsReportsTable.aiModel,
        adsReportsTable.module,
      );

    return res.json(buckets);
  } catch (error) {
    console.error("[ads-strategy/cost-summary] failed", error);
    return res.status(500).json({ error: "Failed to compute cost summary" });
  }
}
