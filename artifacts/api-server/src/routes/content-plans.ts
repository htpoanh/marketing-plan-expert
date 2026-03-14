import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contentPlansTable, brandsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router: IRouter = Router();

router.post("/generate", async (req, res) => {
  try {
    const { brandId, days, platform, campaignGoal, startDate } = req.body;

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) return res.status(404).json({ error: "Brand not found" });

    const prompt = `Bạn là chuyên gia lập kế hoạch nội dung marketing. Tạo kế hoạch nội dung ${days} ngày cho:

THƯƠNG HIỆU: ${brand.brandName}
NGÀNH: ${brand.industry}
ĐỊA ĐIỂM: ${brand.branchLocation}
KHÁCH HÀNG MỤC TIÊU: ${brand.targetAudience}
GIỌNG ĐIỆU: ${brand.brandVoice}
NỀN TẢNG: ${platform}
MỤC TIÊU: ${campaignGoal}
NGÀY BẮT ĐẦU: ${startDate}

Tạo mảng JSON gồm ${days} bài đăng, mỗi bài có:
{
  "dayOffset": 0,
  "contentType": "post/reel/story/video",
  "topic": "chủ đề bài",
  "hook": "câu mở đầu thu hút",
  "caption": "caption đầy đủ",
  "shortCaption": "caption ngắn",
  "cta": "kêu gọi hành động",
  "hashtags": "#hashtag1 #hashtag2 ...",
  "imagePrompt": "English prompt for AI image generation",
  "videoPrompt": "English prompt for AI video generation"
}

Phân bổ đa dạng: promotional, educational, entertaining, behind-the-scenes, testimonial, seasonal.
dayOffset bắt đầu từ 0.
Trả về mảng JSON thuần túy, không markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    let planItems;
    try {
      planItems = JSON.parse(response.text ?? "[]");
    } catch {
      planItems = [];
    }

    const start = new Date(startDate);
    const inserted = await Promise.all(planItems.map(async (item: any) => {
      const publishDate = new Date(start);
      publishDate.setDate(publishDate.getDate() + (item.dayOffset ?? 0));

      const [plan] = await db.insert(contentPlansTable).values({
        brandId,
        publishDate,
        platform,
        contentType: item.contentType ?? "post",
        topic: item.topic ?? "",
        hook: item.hook ?? null,
        caption: item.caption ?? null,
        shortCaption: item.shortCaption ?? null,
        cta: item.cta ?? null,
        hashtags: item.hashtags ?? null,
        imagePrompt: item.imagePrompt ?? null,
        videoPrompt: item.videoPrompt ?? null,
        status: "draft",
      }).returning();
      return plan;
    }));

    res.json(inserted);
  } catch (error) {
    console.error("Error generating content plan:", error);
    res.status(500).json({ error: "Failed to generate content plan" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { brandId, status } = req.query;
    const conditions = [];
    if (brandId) conditions.push(eq(contentPlansTable.brandId, parseInt(brandId as string)));
    if (status) conditions.push(eq(contentPlansTable.status, status as string));

    const plans = conditions.length > 0
      ? await db.select().from(contentPlansTable).where(and(...conditions)).orderBy(contentPlansTable.publishDate)
      : await db.select().from(contentPlansTable).orderBy(contentPlansTable.publishDate);

    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch content plans" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [plan] = await db.insert(contentPlansTable).values({
      brandId: body.brandId,
      publishDate: new Date(body.publishDate),
      platform: body.platform,
      contentType: body.contentType,
      topic: body.topic,
      hook: body.hook ?? null,
      caption: body.caption ?? null,
      shortCaption: body.shortCaption ?? null,
      cta: body.cta ?? null,
      hashtags: body.hashtags ?? null,
      imagePrompt: body.imagePrompt ?? null,
      videoPrompt: body.videoPrompt ?? null,
      status: "draft",
    }).returning();
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: "Failed to create content plan" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(contentPlansTable).where(eq(contentPlansTable.id, id));
    if (!plan) return res.status(404).json({ error: "Content plan not found" });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch content plan" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const updateData: any = { updatedAt: new Date() };
    if (body.publishDate) updateData.publishDate = new Date(body.publishDate);
    if (body.platform) updateData.platform = body.platform;
    if (body.contentType) updateData.contentType = body.contentType;
    if (body.topic) updateData.topic = body.topic;
    if (body.hook !== undefined) updateData.hook = body.hook;
    if (body.caption !== undefined) updateData.caption = body.caption;
    if (body.shortCaption !== undefined) updateData.shortCaption = body.shortCaption;
    if (body.cta !== undefined) updateData.cta = body.cta;
    if (body.hashtags !== undefined) updateData.hashtags = body.hashtags;
    if (body.imagePrompt !== undefined) updateData.imagePrompt = body.imagePrompt;
    if (body.videoPrompt !== undefined) updateData.videoPrompt = body.videoPrompt;
    if (body.status) updateData.status = body.status;

    const [plan] = await db.update(contentPlansTable).set(updateData).where(eq(contentPlansTable.id, id)).returning();
    if (!plan) return res.status(404).json({ error: "Content plan not found" });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Failed to update content plan" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(contentPlansTable).where(eq(contentPlansTable.id, id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete content plan" });
  }
});

router.post("/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.update(contentPlansTable)
      .set({ status: "approved", rejectReason: null, updatedAt: new Date() })
      .where(eq(contentPlansTable.id, id))
      .returning();
    if (!plan) return res.status(404).json({ error: "Content plan not found" });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Failed to approve content plan" });
  }
});

router.post("/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    const [plan] = await db.update(contentPlansTable)
      .set({ status: "rejected", rejectReason: reason ?? null, updatedAt: new Date() })
      .where(eq(contentPlansTable.id, id))
      .returning();
    if (!plan) return res.status(404).json({ error: "Content plan not found" });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Failed to reject content plan" });
  }
});

router.post("/:id/publish", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(contentPlansTable).where(eq(contentPlansTable.id, id));
    if (!plan) return res.status(404).json({ error: "Content plan not found" });

    const metricoolWebhook = process.env.METRICOOL_WEBHOOK_URL;
    let metricoolJobId: string | null = null;

    if (metricoolWebhook) {
      try {
        const resp = await fetch(metricoolWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: plan.platform,
            caption: plan.caption,
            hashtags: plan.hashtags,
            publishDate: plan.publishDate,
            imagePrompt: plan.imagePrompt,
          }),
        });
        if (resp.ok) {
          const data = await resp.json() as any;
          metricoolJobId = data?.id ?? `metricool_${Date.now()}`;
        }
      } catch (e) {
        console.error("Metricool webhook failed:", e);
      }
    }

    const [updated] = await db.update(contentPlansTable)
      .set({ status: "scheduled", metricoolJobId, updatedAt: new Date() })
      .where(eq(contentPlansTable.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to publish content plan" });
  }
});

export default router;
