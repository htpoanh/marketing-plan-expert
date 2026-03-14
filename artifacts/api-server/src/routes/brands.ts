import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { brandsTable, automationSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  try {
    const brands = await db.select().from(brandsTable).orderBy(brandsTable.createdAt);
    res.json(brands);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch brands" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [brand] = await db.insert(brandsTable).values({
      brandName: body.brandName,
      industry: body.industry,
      branchLocation: body.branchLocation,
      address: body.address ?? null,
      phone: body.phone ?? null,
      businessHours: body.businessHours ?? null,
      aiProfileId: body.aiProfileId ? Number(body.aiProfileId) : null,
      targetAudience: body.targetAudience,
      brandVoice: body.brandVoice,
      websiteUrl: body.websiteUrl ?? null,
      facebookUrl: body.facebookUrl ?? null,
      instagramUrl: body.instagramUrl ?? null,
      tiktokUrl: body.tiktokUrl ?? null,
      googlePlaceId: body.googlePlaceId ?? null,
    }).returning();
    res.status(201).json(brand);
  } catch (error) {
    res.status(500).json({ error: "Failed to create brand" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, id));
    if (!brand) return res.status(404).json({ error: "Brand not found" });
    res.json(brand);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch brand" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const [brand] = await db.update(brandsTable)
      .set({
        brandName: body.brandName,
        industry: body.industry,
        branchLocation: body.branchLocation,
        address: body.address ?? null,
        phone: body.phone ?? null,
        businessHours: body.businessHours ?? null,
        aiProfileId: body.aiProfileId ? Number(body.aiProfileId) : null,
        targetAudience: body.targetAudience,
        brandVoice: body.brandVoice,
        websiteUrl: body.websiteUrl ?? null,
        facebookUrl: body.facebookUrl ?? null,
        instagramUrl: body.instagramUrl ?? null,
        tiktokUrl: body.tiktokUrl ?? null,
        googlePlaceId: body.googlePlaceId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(brandsTable.id, id))
      .returning();
    if (!brand) return res.status(404).json({ error: "Brand not found" });
    res.json(brand);
  } catch (error) {
    res.status(500).json({ error: "Failed to update brand" });
  }
});

// ── POST /brands/:id/clone — clone brand + automation settings ────────────────
router.post("/:id/clone", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [src] = await db.select().from(brandsTable).where(eq(brandsTable.id, id));
    if (!src) return res.status(404).json({ error: "Brand not found" });

    const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = src as any;
    const [cloned] = await db.insert(brandsTable).values({
      ...rest,
      brandName: `${src.brandName} (Bản sao)`,
    }).returning();

    // Clone automation settings if they exist
    const [srcSettings] = await db.select().from(automationSettingsTable).where(eq(automationSettingsTable.brandId, id));
    if (srcSettings) {
      const { id: _sid, brandId: _bid, createdAt: _sca, updatedAt: _sua, lastRunAt: _lr, lastRunStatus: _ls, lastRunSummary: _lsum, ...settingsRest } = srcSettings as any;
      await db.insert(automationSettingsTable).values({
        ...settingsRest,
        brandId: cloned.id,
        isEnabled: false,
      }).catch(() => {});
    }

    res.status(201).json(cloned);
  } catch (error) {
    console.error("[clone brand]", error);
    res.status(500).json({ error: "Failed to clone brand" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(brandsTable).where(eq(brandsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Brand not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete brand" });
  }
});

export default router;
