import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  adsPerformanceTable,
  brandsTable,
  ADS_PLATFORMS,
  type AdsPlatform,
} from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { READERS } from "../../services/ads-analysis/readers";
import {
  suggestReallocation,
  crossPlatformSummary,
  type PerfInput,
} from "../../services/ads-analysis/budget-optimizer";

const router: IRouter = Router();

function isoWeekStart(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

// ── POST /ads-performance/scan ───────────────────────────────────────────────
// Runs all readers for a brand. Inactive readers (missing keys) are reported,
// not persisted; active readers persist a row.
router.post("/scan", async (req, res) => {
  try {
    const brandId = Number(req.body?.brandId);
    if (Number.isNaN(brandId)) return res.status(400).json({ error: "brandId erforderlich" });
    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) return res.status(404).json({ error: "Marke nicht gefunden" });

    const weekStart = isoWeekStart();
    const statuses: Array<{ platform: AdsPlatform; active: boolean; reason?: string }> = [];
    const inserted = [];

    for (const platform of ADS_PLATFORMS) {
      try {
        const result = await READERS[platform](brandId, weekStart);
        if (!result.active) {
          statuses.push({ platform, active: false, reason: result.reason });
          continue;
        }
        const [row] = await db.insert(adsPerformanceTable).values(result.row).returning();
        inserted.push(row);
        statuses.push({ platform, active: true });
      } catch (e) {
        statuses.push({ platform, active: false, reason: e instanceof Error ? e.message : String(e) });
      }
    }

    return res.json({ weekStart, statuses, inserted });
  } catch (error) {
    console.error("[ads-performance/scan] failed", error);
    return res.status(500).json({ error: "Ads-Scan fehlgeschlagen" });
  }
});

// ── GET /ads-performance ─────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
    const platform = req.query.platform as string | undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);

    const conditions = [];
    if (brandId !== undefined && !Number.isNaN(brandId)) {
      conditions.push(eq(adsPerformanceTable.brandId, brandId));
    }
    if (platform && ADS_PLATFORMS.includes(platform as AdsPlatform)) {
      conditions.push(eq(adsPerformanceTable.platform, platform as AdsPlatform));
    }

    const rows = await db
      .select()
      .from(adsPerformanceTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adsPerformanceTable.weekStart))
      .limit(limit);

    return res.json(rows);
  } catch (error) {
    console.error("[ads-performance] list failed", error);
    return res.status(500).json({ error: "Failed to list ads performance" });
  }
});

// ── GET /ads-performance/summary?brandId ─────────────────────────────────────
// Cross-platform blended ROAS + a reallocation suggestion from latest rows.
router.get("/summary", async (req, res) => {
  try {
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
    const conditions = brandId !== undefined && !Number.isNaN(brandId)
      ? [eq(adsPerformanceTable.brandId, brandId)]
      : [];
    const rows = await db
      .select()
      .from(adsPerformanceTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adsPerformanceTable.weekStart))
      .limit(50);

    // Latest row per platform.
    const latestByPlatform = new Map<string, PerfInput>();
    for (const r of rows) {
      if (latestByPlatform.has(r.platform)) continue;
      latestByPlatform.set(r.platform, {
        platform: r.platform,
        spendEur: r.spendEur ? parseFloat(r.spendEur) : 0,
        roas: r.roas != null ? parseFloat(r.roas) : null,
      });
    }
    const perf = [...latestByPlatform.values()];
    return res.json({
      summary: crossPlatformSummary(perf),
      suggestion: suggestReallocation(perf),
    });
  } catch (error) {
    console.error("[ads-performance/summary] failed", error);
    return res.status(500).json({ error: "Failed to compute summary" });
  }
});

export default router;
