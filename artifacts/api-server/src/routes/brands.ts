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

// ── Ads context (Phase 4) ────────────────────────────────────────────────────
// GET / PATCH the JSONB ads_context column + service_radius_km + avg_ticket
// fields as a single envelope. Editing this auto-bumps brands.updatedAt
// which in turn invalidates the 7-day Ads Strategy cache for that brand
// (cache key includes brand.updatedAt) — so the next M1/M2/M3/M4 run
// picks up the new context without manual purge.

function envelopeFrom(brand: typeof brandsTable.$inferSelect) {
  return {
    brandId: brand.id,
    adsContext: brand.adsContext ?? null,
    serviceRadiusKm: brand.serviceRadiusKm ?? null,
    avgTicketSizeEur: brand.avgTicketSizeEur ?? null,
    updatedAt: brand.updatedAt,
  };
}

router.get("/:id/ads-context", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [brand] = await db
      .select()
      .from(brandsTable)
      .where(eq(brandsTable.id, id));
    if (!brand) return res.status(404).json({ error: "Brand not found" });
    return res.json(envelopeFrom(brand));
  } catch (error) {
    console.error("[brands/ads-context get]", error);
    return res.status(500).json({ error: "Failed to fetch ads context" });
  }
});

router.patch("/:id/ads-context", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const body = req.body as {
      adsContext?: unknown;
      serviceRadiusKm?: number | null;
      avgTicketSizeEur?: string | null;
    };

    // Light validation — heavy validation happens at the OpenAPI/Zod layer
    // when frontend uses the generated schema. Here we just guard against
    // wildly wrong types so we don't poison the JSONB.
    if (
      body.adsContext != null &&
      typeof body.adsContext !== "object"
    ) {
      return res
        .status(400)
        .json({ error: "adsContext must be an object or null" });
    }
    if (
      body.serviceRadiusKm != null &&
      (typeof body.serviceRadiusKm !== "number" ||
        body.serviceRadiusKm < 0 ||
        body.serviceRadiusKm > 10000)
    ) {
      return res
        .status(400)
        .json({ error: "serviceRadiusKm must be 0-10000 or null" });
    }
    if (
      body.avgTicketSizeEur != null &&
      typeof body.avgTicketSizeEur !== "string"
    ) {
      return res
        .status(400)
        .json({ error: "avgTicketSizeEur must be a decimal-as-string or null" });
    }

    const [updated] = await db
      .update(brandsTable)
      .set({
        // Allow partial updates — only set fields that were provided
        ...(body.adsContext !== undefined
          ? { adsContext: body.adsContext as typeof brandsTable.$inferSelect.adsContext }
          : {}),
        ...(body.serviceRadiusKm !== undefined
          ? { serviceRadiusKm: body.serviceRadiusKm }
          : {}),
        ...(body.avgTicketSizeEur !== undefined
          ? { avgTicketSizeEur: body.avgTicketSizeEur }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(brandsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Brand not found" });
    return res.json(envelopeFrom(updated));
  } catch (error) {
    console.error("[brands/ads-context patch]", error);
    return res.status(500).json({ error: "Failed to update ads context" });
  }
});

export default router;
