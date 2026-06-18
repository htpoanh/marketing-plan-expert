import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contentPlansTable, brandsTable, trendInsightsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateContentDraft } from "../../services/content-pipeline/generate.service";
import { pushMetricoolDraft } from "../../services/content-pipeline/metricool-push";

const router: IRouter = Router();

// ── POST /content-pipeline/generate ──────────────────────────────────────────
// Body: { brandId, topic, platform?, trendInsightId?, strategyInboxId?, pushMetricool? }
router.post("/generate", async (req, res) => {
  try {
    const brandId = Number(req.body?.brandId);
    const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
    if (Number.isNaN(brandId)) return res.status(400).json({ error: "brandId erforderlich" });
    if (!topic) return res.status(400).json({ error: "topic erforderlich" });

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) return res.status(404).json({ error: "Marke nicht gefunden" });

    // Optional trend context.
    let trendContext: string | null = null;
    let trendSource: string | null = null;
    const trendInsightId = req.body?.trendInsightId ? Number(req.body.trendInsightId) : null;
    if (trendInsightId && !Number.isNaN(trendInsightId)) {
      const [t] = await db.select().from(trendInsightsTable).where(eq(trendInsightsTable.id, trendInsightId));
      if (t) {
        trendContext = `${t.trendName}: ${t.suggestedAngle ?? ""}`;
        trendSource = `trend_insight:${t.id}`;
      }
    }

    let draft;
    try {
      draft = await generateContentDraft({ topic, trendContext }, brand);
    } catch (e) {
      return res.status(502).json({ error: `AI-Fehler: ${e instanceof Error ? e.message : String(e)}` });
    }

    const platform = typeof req.body?.platform === "string" ? req.body.platform : "Instagram";
    const strategyInboxId = req.body?.strategyInboxId ? Number(req.body.strategyInboxId) : null;
    // Default scheduled for next week (review window on Metricool).
    const scheduled = new Date();
    scheduled.setDate(scheduled.getDate() + 7);

    const [created] = await db
      .insert(contentPlansTable)
      .values({
        brandId,
        publishDate: scheduled,
        platform,
        contentType: "post",
        topic,
        caption: draft.caption,
        shortCaption: draft.caption,
        hashtags: draft.hashtags,
        imagePrompt: draft.imagePrompt,
        videoPrompt: draft.videoPrompt,
        aiReasoning: draft.aiReasoning,
        trendSource,
        strategyInboxId,
        scheduledDate: scheduled,
        status: "draft",
      })
      .returning();

    // Optional Metricool draft push (inactive without keys).
    let metricool: Awaited<ReturnType<typeof pushMetricoolDraft>> | null = null;
    if (req.body?.pushMetricool) {
      try {
        metricool = await pushMetricoolDraft({
          brandName: brand.brandName,
          text: `${draft.caption}\n\n${draft.hashtags}`,
          scheduledIso: scheduled.toISOString(),
        });
        if (metricool.active) {
          await db
            .update(contentPlansTable)
            .set({ metricoolPostId: metricool.postId, updatedAt: new Date() })
            .where(eq(contentPlansTable.id, created.id));
        }
      } catch (e) {
        metricool = { active: false, reason: e instanceof Error ? e.message : String(e) };
      }
    }

    return res.status(201).json({ plan: created, metricool });
  } catch (error) {
    console.error("[content-pipeline/generate] failed", error);
    return res.status(500).json({ error: "Content-Generierung fehlgeschlagen" });
  }
});

export default router;
