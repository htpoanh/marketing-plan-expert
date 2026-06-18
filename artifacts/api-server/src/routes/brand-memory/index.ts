import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { brandMemoryTable, brandsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { rebuildBrandMemory } from "../../services/brand-memory/aggregate.service";

const router: IRouter = Router();

// ── GET /brand-memory/:brandId ───────────────────────────────────────────────
router.get("/:brandId", async (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId, 10);
    if (Number.isNaN(brandId)) return res.status(400).json({ error: "Invalid brandId" });
    const [row] = await db
      .select()
      .from(brandMemoryTable)
      .where(eq(brandMemoryTable.brandId, brandId));
    if (!row) return res.status(404).json({ error: "Noch keine Memory für diese Marke" });
    return res.json(row);
  } catch (error) {
    console.error("[brand-memory] get failed", error);
    return res.status(500).json({ error: "Failed to fetch brand memory" });
  }
});

// ── POST /brand-memory/:brandId/rebuild ──────────────────────────────────────
router.post("/:brandId/rebuild", async (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId, 10);
    if (Number.isNaN(brandId)) return res.status(400).json({ error: "Invalid brandId" });
    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) return res.status(404).json({ error: "Marke nicht gefunden" });
    const memory = await rebuildBrandMemory(brandId);
    return res.json(memory);
  } catch (error) {
    console.error("[brand-memory] rebuild failed", error);
    return res.status(500).json({ error: "Failed to rebuild brand memory" });
  }
});

export default router;
