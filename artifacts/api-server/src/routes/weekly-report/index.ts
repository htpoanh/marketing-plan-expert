import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { weeklyReportsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { generateWeeklyReport } from "../../services/weekly-report/generator.service";

const router: IRouter = Router();

// ── POST /weekly-report/generate ─────────────────────────────────────────────
router.post("/generate", async (_req, res) => {
  try {
    const report = await generateWeeklyReport();
    return res.status(201).json(report);
  } catch (error) {
    console.error("[weekly-report/generate] failed", error);
    return res.status(500).json({ error: "Report-Generierung fehlgeschlagen" });
  }
});

// ── GET /weekly-report ───────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const rows = await db
      .select()
      .from(weeklyReportsTable)
      .orderBy(desc(weeklyReportsTable.createdAt))
      .limit(limit);
    return res.json(rows);
  } catch (error) {
    console.error("[weekly-report] list failed", error);
    return res.status(500).json({ error: "Failed to list reports" });
  }
});

// ── GET /weekly-report/:id ───────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db.select().from(weeklyReportsTable).where(eq(weeklyReportsTable.id, id));
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (error) {
    console.error("[weekly-report] get failed", error);
    return res.status(500).json({ error: "Failed to fetch report" });
  }
});

// ── POST /weekly-report/:id/approve ──────────────────────────────────────────
router.post("/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db
      .update(weeklyReportsTable)
      .set({ approvedByUser: true, approvedAt: new Date() })
      .where(eq(weeklyReportsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (error) {
    console.error("[weekly-report] approve failed", error);
    return res.status(500).json({ error: "Failed to approve report" });
  }
});

export default router;
