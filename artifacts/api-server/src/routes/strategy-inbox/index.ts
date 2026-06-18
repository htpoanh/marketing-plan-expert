import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  strategyInboxTable,
  brandsTable,
  STRATEGY_INPUT_TYPES,
  STRATEGY_PRIORITIES,
  STRATEGY_STATUSES,
  type Brand,
  type StrategyInputType,
  type StrategyPriority,
  type StrategyStatus,
  type StrategyInboxItem,
} from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { analyzeStrategyItem } from "../../services/strategy-inbox/analyze.service";

const router: IRouter = Router();

async function loadBrand(brandId: number | null | undefined): Promise<Brand | null> {
  if (brandId === null || brandId === undefined) return null;
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  return brand ?? null;
}

// Run Claude analysis for an item and persist it. Returns the updated row.
async function runAnalysis(item: StrategyInboxItem): Promise<StrategyInboxItem> {
  const brand = await loadBrand(item.brandId);
  const result = await analyzeStrategyItem(
    {
      inputType: item.inputType,
      content: item.content,
      priority: item.priority,
      deadline: item.deadline,
    },
    brand,
  );
  const [updated] = await db
    .update(strategyInboxTable)
    .set({
      claudeAnalysis: result.analysis,
      status: "analyzed",
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      updatedAt: new Date(),
    })
    .where(eq(strategyInboxTable.id, item.id))
    .returning();
  return updated;
}

// ── GET /strategy-inbox ──────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
    const status = req.query.status as string | undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    if (status && !STRATEGY_STATUSES.includes(status as StrategyStatus)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const conditions = [];
    if (brandId !== undefined && !Number.isNaN(brandId)) {
      conditions.push(eq(strategyInboxTable.brandId, brandId));
    }
    if (status) conditions.push(eq(strategyInboxTable.status, status as StrategyStatus));

    const rows = await db
      .select()
      .from(strategyInboxTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(strategyInboxTable.createdAt))
      .limit(limit);

    return res.json(rows);
  } catch (error) {
    console.error("[strategy-inbox] list failed", error);
    return res.status(500).json({ error: "Failed to list strategy inbox" });
  }
});

// ── POST /strategy-inbox (create + analyse) ──────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { brandId, inputType, content, priority, deadline } = req.body ?? {};

    if (!inputType || !STRATEGY_INPUT_TYPES.includes(inputType as StrategyInputType)) {
      return res.status(400).json({ error: "inputType ungültig" });
    }
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "content ist erforderlich" });
    }
    const prio: StrategyPriority =
      priority && STRATEGY_PRIORITIES.includes(priority as StrategyPriority)
        ? (priority as StrategyPriority)
        : "medium";

    // Validate brandId if provided.
    let resolvedBrandId: number | null = null;
    if (brandId !== null && brandId !== undefined && brandId !== "") {
      const n = Number(brandId);
      if (Number.isNaN(n)) return res.status(400).json({ error: "brandId ungültig" });
      const brand = await loadBrand(n);
      if (!brand) return res.status(400).json({ error: "Marke nicht gefunden" });
      resolvedBrandId = n;
    }

    const [created] = await db
      .insert(strategyInboxTable)
      .values({
        brandId: resolvedBrandId,
        inputType: inputType as StrategyInputType,
        content: content.trim(),
        priority: prio,
        deadline: deadline || null,
        status: "pending",
      })
      .returning();

    try {
      const analysed = await runAnalysis(created);
      return res.status(201).json(analysed);
    } catch (aiErr) {
      // Persisted as pending; surface a soft error but keep the row.
      console.error("[strategy-inbox] analysis failed", aiErr);
      return res.status(201).json(created);
    }
  } catch (error) {
    console.error("[strategy-inbox] create failed", error);
    return res.status(500).json({ error: "Failed to create strategy item" });
  }
});

// ── GET /strategy-inbox/:id ──────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db.select().from(strategyInboxTable).where(eq(strategyInboxTable.id, id));
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (error) {
    console.error("[strategy-inbox] get failed", error);
    return res.status(500).json({ error: "Failed to fetch item" });
  }
});

// ── PATCH /strategy-inbox/:id ────────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const { status, incorporatedInWeek, priority } = req.body ?? {};
    if (status && STRATEGY_STATUSES.includes(status as StrategyStatus)) patch.status = status;
    if (priority && STRATEGY_PRIORITIES.includes(priority as StrategyPriority)) patch.priority = priority;
    if (incorporatedInWeek === null || typeof incorporatedInWeek === "number") {
      patch.incorporatedInWeek = incorporatedInWeek;
    }

    const [row] = await db
      .update(strategyInboxTable)
      .set(patch)
      .where(eq(strategyInboxTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (error) {
    console.error("[strategy-inbox] update failed", error);
    return res.status(500).json({ error: "Failed to update item" });
  }
});

// ── DELETE /strategy-inbox/:id ───────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [deleted] = await db
      .delete(strategyInboxTable)
      .where(eq(strategyInboxTable.id, id))
      .returning({ id: strategyInboxTable.id });
    if (!deleted) return res.status(404).json({ error: "Not found" });
    return res.status(204).end();
  } catch (error) {
    console.error("[strategy-inbox] delete failed", error);
    return res.status(500).json({ error: "Failed to delete item" });
  }
});

// ── POST /strategy-inbox/:id/reanalyze ───────────────────────────────────────
router.post("/:id/reanalyze", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [item] = await db.select().from(strategyInboxTable).where(eq(strategyInboxTable.id, id));
    if (!item) return res.status(404).json({ error: "Not found" });
    try {
      const analysed = await runAnalysis(item);
      return res.json(analysed);
    } catch (aiErr) {
      console.error("[strategy-inbox] reanalyze failed", aiErr);
      return res.status(502).json({ error: "AI-Analyse fehlgeschlagen. Bitte erneut versuchen." });
    }
  } catch (error) {
    console.error("[strategy-inbox] reanalyze failed", error);
    return res.status(500).json({ error: "Failed to reanalyze item" });
  }
});

export default router;
