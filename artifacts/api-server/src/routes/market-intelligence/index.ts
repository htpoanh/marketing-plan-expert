import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  marketIntelligenceTable,
  brandsTable,
} from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { scanMarketIntelligence } from "../../services/market-intelligence/synthesizer";

const router: IRouter = Router();

// ── POST /market-intelligence/scan ───────────────────────────────────────────
router.post("/scan", async (req, res) => {
  try {
    const brandId = Number(req.body?.brandId);
    if (Number.isNaN(brandId)) return res.status(400).json({ error: "brandId erforderlich" });
    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) return res.status(404).json({ error: "Marke nicht gefunden" });

    const rows = await scanMarketIntelligence(brand);
    const inserted = rows.length > 0
      ? await db.insert(marketIntelligenceTable).values(rows).returning()
      : [];
    return res.json({ inserted });
  } catch (error) {
    console.error("[market-intelligence/scan] failed", error);
    return res.status(500).json({ error: "Market-Scan fehlgeschlagen" });
  }
});

// ── GET /market-intelligence ─────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
    const source = req.query.source as string | undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);

    const conditions = [];
    if (brandId !== undefined && !Number.isNaN(brandId)) {
      conditions.push(eq(marketIntelligenceTable.brandId, brandId));
    }
    if (source) conditions.push(eq(marketIntelligenceTable.source, source));

    const rows = await db
      .select()
      .from(marketIntelligenceTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(marketIntelligenceTable.createdAt))
      .limit(limit);

    return res.json(rows);
  } catch (error) {
    console.error("[market-intelligence] list failed", error);
    return res.status(500).json({ error: "Failed to list market intelligence" });
  }
});

// ── DELETE /market-intelligence/:id ──────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [deleted] = await db
      .delete(marketIntelligenceTable)
      .where(eq(marketIntelligenceTable.id, id))
      .returning({ id: marketIntelligenceTable.id });
    if (!deleted) return res.status(404).json({ error: "Not found" });
    return res.status(204).end();
  } catch (error) {
    console.error("[market-intelligence] delete failed", error);
    return res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
