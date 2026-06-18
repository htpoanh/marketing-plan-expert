import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  trendInsightsTable,
  strategyInboxTable,
  brandsTable,
  TREND_INSIGHT_STATUSES,
  type TrendInsightStatus,
  type Brand,
} from "@workspace/db/schema";
import { and, desc, eq, or, isNull } from "drizzle-orm";
import { scanTrends } from "../../services/trend-intelligence/scan.service";

const router: IRouter = Router();

// ── POST /trend-intelligence/scan ────────────────────────────────────────────
// Body: { brandId, regionFocus? }. Runs Claude Web Search, scores, persists, returns rows.
router.post("/scan", async (req, res) => {
  try {
    const brandId = Number(req.body?.brandId);
    if (Number.isNaN(brandId)) return res.status(400).json({ error: "brandId erforderlich" });

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) return res.status(404).json({ error: "Marke nicht gefunden" });

    const region =
      (typeof req.body?.regionFocus === "string" && req.body.regionFocus.trim()) ||
      pickRegion(brand);

    // Pull open strategy-inbox items for this brand (or all-brand items) for cross-check.
    const strategyRows = await db
      .select({ content: strategyInboxTable.content })
      .from(strategyInboxTable)
      .where(
        and(
          or(eq(strategyInboxTable.brandId, brandId), isNull(strategyInboxTable.brandId)),
          or(eq(strategyInboxTable.status, "pending"), eq(strategyInboxTable.status, "analyzed")),
        ),
      );
    const strategyTexts = strategyRows.map((r) => r.content);

    let scan;
    try {
      scan = await scanTrends(brand, strategyTexts, region);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[trend-intelligence/scan] AI call failed", message);
      return res.status(502).json({ error: `KI-Fehler bei der Trend-Suche: ${message}` });
    }

    if (scan.items.length === 0) {
      return res.json({ inserted: [], costEur: scan.costEur, region });
    }

    const inserted = await db.insert(trendInsightsTable).values(scan.items).returning();
    return res.json({ inserted, costEur: scan.costEur, region });
  } catch (error) {
    console.error("[trend-intelligence/scan] failed", error);
    return res.status(500).json({ error: "Trend-Scan fehlgeschlagen" });
  }
});

// ── GET /trend-intelligence ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
    const status = req.query.status as string | undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    if (status && !TREND_INSIGHT_STATUSES.includes(status as TrendInsightStatus)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const conditions = [];
    if (brandId !== undefined && !Number.isNaN(brandId)) {
      conditions.push(eq(trendInsightsTable.brandId, brandId));
    }
    if (status) conditions.push(eq(trendInsightsTable.status, status as TrendInsightStatus));

    const rows = await db
      .select()
      .from(trendInsightsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(trendInsightsTable.trendScore))
      .limit(limit);

    return res.json(rows);
  } catch (error) {
    console.error("[trend-intelligence] list failed", error);
    return res.status(500).json({ error: "Failed to list trend insights" });
  }
});

// ── PATCH /trend-intelligence/:id (status) ───────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const status = req.body?.status as string | undefined;
    if (!status || !TREND_INSIGHT_STATUSES.includes(status as TrendInsightStatus)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const [row] = await db
      .update(trendInsightsTable)
      .set({ status: status as TrendInsightStatus, updatedAt: new Date() })
      .where(eq(trendInsightsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (error) {
    console.error("[trend-intelligence] update failed", error);
    return res.status(500).json({ error: "Failed to update insight" });
  }
});

// ── DELETE /trend-intelligence/:id ───────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [deleted] = await db
      .delete(trendInsightsTable)
      .where(eq(trendInsightsTable.id, id))
      .returning({ id: trendInsightsTable.id });
    if (!deleted) return res.status(404).json({ error: "Not found" });
    return res.status(204).end();
  } catch (error) {
    console.error("[trend-intelligence] delete failed", error);
    return res.status(500).json({ error: "Failed to delete insight" });
  }
});

function pickRegion(brand: Brand): string {
  const ctx = (brand.adsContext ?? {}) as { primaryRegions?: string[] };
  return ctx.primaryRegions?.[0] ?? brand.branchLocation;
}

export default router;
