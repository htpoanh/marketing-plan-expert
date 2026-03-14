import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contentPlansTable, brandsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.status) updateData.status = body.status;

    const [plan] = await db.update(contentPlansTable).set(updateData).where(eq(contentPlansTable.id, id)).returning();
    if (!plan) return res.status(404).json({ error: "Content plan not found" });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Failed to update content plan" });
  }
});

// Rate prompt quality for ML training data
router.patch("/:id/rate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rating } = req.body as { rating: "good" | "bad" | null };
    const [plan] = await db.update(contentPlansTable)
      .set({ promptRating: rating ?? null, updatedAt: new Date() })
      .where(eq(contentPlansTable.id, id))
      .returning();
    if (!plan) return res.status(404).json({ error: "Not found" });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Failed to save rating" });
  }
});

// Bulk delete
router.post("/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body as { ids: number[] };
    if (!ids?.length) return res.status(400).json({ error: "No IDs provided" });
    const { inArray } = await import("drizzle-orm");
    await db.delete(contentPlansTable).where(inArray(contentPlansTable.id, ids));
    res.json({ deleted: ids.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to bulk delete" });
  }
});

// Bulk send to review
router.post("/bulk-review", async (req, res) => {
  try {
    const { ids } = req.body as { ids: number[] };
    if (!ids?.length) return res.status(400).json({ error: "No IDs provided" });
    const { inArray } = await import("drizzle-orm");
    await db.update(contentPlansTable)
      .set({ status: "review", updatedAt: new Date() })
      .where(inArray(contentPlansTable.id, ids));
    res.json({ updated: ids.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to bulk update" });
  }
});

router.post("/:id/generate-image", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { provider = "dalle3", referenceImages = [], saveToDb = true } = req.body as {
      provider?: "dalle3" | "dalle3-natural" | "gpt-image-1";
      referenceImages?: string[]; // base64 data URLs for style analysis
      saveToDb?: boolean;
    };

    const [plan] = await db.select().from(contentPlansTable).where(eq(contentPlansTable.id, id));
    if (!plan) return res.status(404).json({ error: "Content plan not found" });

    // Load brand data for style context
    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, plan.brandId));

    const basePrompt = plan.imagePrompt ?? `Marketing image for ${plan.topic}`;

    // Build brand context string
    const brandContext = brand ? [
      brand.industry ? `Industry: ${brand.industry}` : "",
      brand.brandVoice ? `Brand Voice: ${brand.brandVoice}` : "",
      brand.targetAudience ? `Target Audience: ${brand.targetAudience}` : "",
    ].filter(Boolean).join(". ") : "";

    // Analyze reference images for style if provided
    let styleDescription = "";
    if (referenceImages.length > 0) {
      try {
        const visionMessages: any[] = [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze the visual style of this reference image to use as a style guide for marketing image generation. Describe in detail: dominant colors, lighting, composition, photography style, overall atmosphere, textures/materials, and brand presentation approach. Focus on what makes this image work visually. Return only the style description, no additional explanation.`,
              },
              ...referenceImages.slice(0, 3).map((img) => ({
                type: "image_url",
                image_url: { url: img, detail: "auto" },
              })),
            ],
          },
        ];
        const visionRes = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: visionMessages,
          max_tokens: 600,
        });
        styleDescription = visionRes.choices[0]?.message?.content ?? "";
      } catch (e) {
        console.warn("Vision analysis failed, skipping:", e);
      }
    }

    // Build final enriched prompt
    const parts = [basePrompt];
    if (brandContext) parts.push(`Brand context: ${brandContext}`);
    if (styleDescription) parts.push(`Visual style reference: ${styleDescription}`);
    parts.push("Professional marketing photo. High quality, commercial grade.");
    const enrichedPrompt = parts.join(" | ").substring(0, 1000);

    let imageUrl: string | undefined;
    let imageBase64: string | undefined;

    if (provider === "dalle3" || provider === "dalle3-natural") {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enrichedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: provider === "dalle3-natural" ? "natural" : "vivid",
        response_format: "url",
      });
      imageUrl = response.data[0]?.url ?? undefined;

    } else if (provider === "gpt-image-1") {
      // gpt-image-1 uses "low"/"medium"/"high"/"auto" — not "standard"
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: enrichedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
      } as any);
      const b64 = (response.data[0] as any)?.b64_json;
      if (b64) {
        imageBase64 = `data:image/png;base64,${b64}`;
        imageUrl = imageBase64;
      } else {
        imageUrl = response.data[0]?.url ?? undefined;
      }

    }

    if (!imageUrl) return res.status(500).json({ error: "Không tạo được hình ảnh" });

    // Save to DB if URL-based (skip data URLs which are too large for DB)
    let updatedPlan = plan;
    if (saveToDb && imageUrl && !imageUrl.startsWith("data:")) {
      const [u] = await db.update(contentPlansTable)
        .set({ imageUrl, updatedAt: new Date() })
        .where(eq(contentPlansTable.id, id))
        .returning();
      if (u) updatedPlan = u;
    }

    res.json({
      imageUrl,
      imageBase64: imageUrl?.startsWith("data:") ? imageUrl : undefined,
      provider,
      enrichedPrompt,
      styleDescription: styleDescription || undefined,
      plan: updatedPlan,
    });
  } catch (error: any) {
    console.error("Generate image error:", error);
    res.status(500).json({ error: error?.message ?? "Failed to generate image" });
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

    const makeWebhook = process.env.MAKE_WEBHOOK_URL;
    let metricoolJobId: string | null = null;

    if (makeWebhook) {
      try {
        const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, plan.brandId));
        const fullCaption = [plan.caption, plan.hashtags].filter(Boolean).join("\n\n");
        const resp = await fetch(makeWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "publish_to_metricool",
            contentPlanId: plan.id,
            brandName: brand?.brandName ?? "",
            platform: plan.platform,
            contentType: plan.contentType,
            topic: plan.topic,
            caption: fullCaption,
            shortCaption: plan.shortCaption ?? "",
            cta: plan.cta ?? "",
            hashtags: plan.hashtags ?? "",
            hook: plan.hook ?? "",
            imagePrompt: plan.imagePrompt ?? "",
            videoPrompt: plan.videoPrompt ?? "",
            publishDate: plan.publishDate,
            scheduledAt: plan.publishDate?.toISOString() ?? new Date().toISOString(),
          }),
        });
        if (resp.ok) {
          let data: any = {};
          try { data = await resp.json(); } catch {}
          metricoolJobId = data?.id ?? data?.jobId ?? `make_${Date.now()}`;
        } else {
          console.error("Make.com webhook failed:", resp.status, await resp.text());
        }
      } catch (e) {
        console.error("Make.com webhook error:", e);
      }
    } else {
      console.warn("MAKE_WEBHOOK_URL not set — skipping Make.com trigger");
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
