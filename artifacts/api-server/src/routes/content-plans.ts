import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contentPlansTable, brandsTable, automationSettingsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const router: IRouter = Router();

// Strip ALL marketing model labels (AIDA, PAS, Hook-Value-CTA, Storytelling, BAB, 4P, FAB...)
// Only strips when label word is followed by colon — preserves natural usage in sentences
const MARKETING_LABEL_RE =
  /\*{0,2}(Attention|Interest|Desire|Action|Problem|Agitate|Amplify|Lösung|Solution|Hook|Value|CTA|Story|Storytelling|Situation|Challenge|Transformation|Before|After|Bridge|Promise|Picture|Proof|Push|Feature|Advantage|Benefit|AIDA|PAS|BAB|FAB|Schritt\s*\d*|Step\s*\d*|Teil\s*\d*|Phase\s*\d*|Kontext|Hintergrund|Konflikt|Auflösung|Nutzwert|Handlungsaufruf)\*{0,2}:\*{0,2}\s*/gi;

function cleanPostText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(MARKETING_LABEL_RE, "")
    .replace(/\*{1,2}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

// ── Rewrite caption shorter or longer (max 250 words) ───────────────────────
router.post("/rewrite-selection", async (req, res) => {
  try {
    const { text, direction, brandId } = req.body as { text: string; direction: "shorter" | "longer"; brandId?: number };
    if (!text?.trim() || !direction) {
      return res.status(400).json({ error: "text and direction are required" });
    }
    let brandName = "ein Unternehmen";
    if (brandId) {
      const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
      if (brand) brandName = brand.brandName;
    }
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const directionInstruction = direction === "shorter"
      ? `Schreibe diesen Abschnitt KÜRZER (Ziel: ${Math.max(8, Math.round(wordCount * 0.55))}–${Math.round(wordCount * 0.7)} Wörter). Behalte die Kernaussage, streiche Füllwörter.`
      : `Schreibe diesen Abschnitt AUSFÜHRLICHER (Ziel: ${Math.round(wordCount * 1.3)}–${Math.round(wordCount * 1.6)} Wörter). Mehr Details, Emotion oder Storytelling.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Du bist ein professioneller Social-Media-Texter für ${brandName} in Deutschland. Schreibe ausschließlich auf Deutsch, natürlich und fließend, ohne Marketing-Labels oder Erklärungen.`,
        },
        {
          role: "user",
          content: `${directionInstruction}\n\nORIGINALTEXT:\n${text}\n\nGib NUR den neuen Text zurück, keine Erklärung:`,
        },
      ],
      temperature: 0.72,
      max_tokens: 300,
    });
    const result = cleanPostText(completion.choices[0]?.message?.content ?? text);
    res.json({ result, wordCount: result.split(/\s+/).filter(Boolean).length });
  } catch (error: any) {
    console.error("Rewrite selection error:", error);
    res.status(500).json({ error: error?.message ?? "Failed to rewrite selection" });
  }
});

router.post("/:id/rewrite", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { direction } = req.body as { direction: "shorter" | "longer" };
    if (!direction || !["shorter", "longer"].includes(direction)) {
      return res.status(400).json({ error: "direction must be 'shorter' or 'longer'" });
    }

    const [plan] = await db.select().from(contentPlansTable).where(eq(contentPlansTable.id, id));
    if (!plan) return res.status(404).json({ error: "Content plan not found" });

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, plan.brandId));

    const currentCaption = cleanPostText(plan.caption);
    const currentWordCount = currentCaption.split(/\s+/).filter(Boolean).length;

    const directionInstruction = direction === "shorter"
      ? `Schreibe die Caption KÜRZER um (Ziel: ${Math.max(60, Math.round(currentWordCount * 0.6))}–${Math.round(currentWordCount * 0.75)} Wörter). Behalte den Kern und die Kernbotschaft. Keine überflüssigen Sätze.`
      : `Schreibe die Caption AUSFÜHRLICHER (Ziel: ${Math.min(250, Math.round(currentWordCount * 1.4))}–${Math.min(250, Math.round(currentWordCount * 1.6))} Wörter). Füge mehr Details, Emotion oder Storytelling hinzu. MAXIMAL 250 Wörter gesamt.`;

    const systemPrompt = `Du bist ein professioneller Social-Media-Texter für ${brand?.brandName ?? "ein Unternehmen"} in Deutschland.
REGELN:
- Schreibe AUSSCHLIESSLICH auf Deutsch
- Keine Marketing-Labels (AIDA, PAS, Hook:, CTA: usw.) — schreibe fließenden Text
- ABSOLUTES MAXIMUM: 250 Wörter für den gesamten Caption-Text
- Behalte den originalen Ton und die Markenidentität
- Gib NUR den neuen Caption-Text zurück, kein JSON, keine Erklärungen`;

    const userPrompt = `${directionInstruction}

ORIGINAL CAPTION (${currentWordCount} Wörter):
${currentCaption}

THEMA: ${plan.topic ?? ""}
HOOK: ${cleanPostText(plan.hook) ?? ""}

Schreibe jetzt den neuen Caption-Text:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.75,
      max_tokens: 500,
    });

    const newCaption = cleanPostText(completion.choices[0]?.message?.content ?? currentCaption);

    const [updated] = await db.update(contentPlansTable)
      .set({ caption: newCaption, updatedAt: new Date() })
      .where(eq(contentPlansTable.id, id))
      .returning();

    const wordCount = newCaption.split(/\s+/).filter(Boolean).length;
    res.json({ ok: true, plan: updated, wordCount });
  } catch (error: any) {
    console.error("Rewrite error:", error);
    res.status(500).json({ error: error?.message ?? "Failed to rewrite content" });
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

router.post("/:id/mark-used", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.update(contentPlansTable)
      .set({ status: "used", updatedAt: new Date() })
      .where(eq(contentPlansTable.id, id))
      .returning();
    if (!plan) return res.status(404).json({ error: "Content plan not found" });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Failed to mark content plan as used" });
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
    const { scheduledAt } = req.body as { scheduledAt?: string }; // user-chosen datetime
    const [plan] = await db.select().from(contentPlansTable).where(eq(contentPlansTable.id, id));
    if (!plan) return res.status(404).json({ error: "Content plan not found" });

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, plan.brandId));
    const [autoSettings] = await db.select().from(automationSettingsTable).where(eq(automationSettingsTable.brandId, plan.brandId));

    const mcToken = autoSettings?.metricoolToken ?? null;
    const mcUserId = autoSettings?.metricoolAccountId ?? null;

    // Build contact block from brand data
    const contactParts = [
      brand?.address ?? "",
      brand?.phone ? `📞 ${brand.phone}` : "",
      brand?.businessHours ? `🕐 ${brand.businessHours}` : "",
    ].filter(Boolean);
    const contactBlock = contactParts.join(" | ");

    // Final post format: hook → caption → contact → hashtags (no AIDA labels)
    const fullText = [
      cleanPostText(plan.hook),
      "",
      cleanPostText(plan.caption),
      contactBlock || null,
      plan.hashtags?.trim(),
    ].filter(v => v !== null && v !== undefined && v !== "").join("\n");
    let metricoolJobId: string | null = null;
    let publishError: string | null = null;

    if (mcToken && mcUserId) {
      // ── DIRECT METRICOOL API ─────────────────────────────────────────────
      try {
        // Use user-chosen date, then plan date, or 30 min from now as fallback
        let targetDate: Date;
        if (scheduledAt) {
          targetDate = new Date(scheduledAt);
        } else if (plan.publishDate && plan.publishDate > new Date()) {
          targetDate = plan.publishDate;
        } else {
          targetDate = new Date(Date.now() + 30 * 60 * 1000);
        }
        const dt = targetDate.toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).replace(" ", "T");

        // Find brand profile
        const profileRes = await fetch(
          `https://app.metricool.com/api/v1.1/analytics/simpleProfiles?userId=${mcUserId}`,
          { headers: { "X-Mc-Auth": mcToken } }
        );
        if (!profileRes.ok) throw new Error(`Metricool profile HTTP ${profileRes.status}`);
        const profileData: any = await profileRes.json();
        const profiles: any[] = Array.isArray(profileData) ? profileData : profileData.data ?? [];
        let profile = profiles.find((p: any) => String(p.id) === String(mcUserId)) ?? profiles[0];
        if (!profile) throw new Error("Không tìm thấy brand trong Metricool");

        const internalBlogId = profile.id;
        const realUserId = profile.userId ?? profile.ownerUserId ?? mcUserId;
        const network = plan.platform.toLowerCase();
        const networkAccounts: Record<string, any[]> = {
          facebook: profile.facebookAccounts ?? [],
          instagram: profile.instagramAccounts ?? [],
          tiktok: profile.tiktokAccounts ?? [],
        };
        const accounts = networkAccounts[network] ?? [];
        if (!accounts.length) throw new Error(`Không có tài khoản ${plan.platform} trong brand Metricool này`);

        const providers = accounts.slice(0, 1).map((acc: any) => ({
          network,
          id: acc.id ?? acc.pageId ?? acc.accountId,
        }));
        const payload = {
          text: fullText,
          publicationDate: { dateTime: dt, timezone: "Europe/Berlin" },
          providers,
          autoPublish: true,
        };
        const schedRes = await fetch(
          `https://app.metricool.com/api/v2/scheduler/posts?userId=${realUserId}&blogId=${internalBlogId}`,
          { method: "POST", headers: { "Content-Type": "application/json", "X-Mc-Auth": mcToken }, body: JSON.stringify(payload) }
        );
        const schedData: any = await schedRes.json().catch(() => ({}));
        if (schedRes.status === 201 || schedRes.ok) {
          metricoolJobId = String(schedData?.data?.id ?? schedData?.id ?? `mc_${Date.now()}`);
        } else {
          throw new Error(`Metricool API ${schedRes.status}: ${JSON.stringify(schedData)}`);
        }
      } catch (e: any) {
        publishError = e.message;
        console.error("[publish] Metricool direct error:", e.message);
      }

    } else {
      // ── MAKE.COM WEBHOOK FALLBACK ────────────────────────────────────────
      const makeWebhook = process.env.MAKE_WEBHOOK_URL;
      if (makeWebhook) {
        try {
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
              caption: fullText,
              shortCaption: plan.shortCaption ?? "",
              cta: plan.cta ?? "",
              hashtags: plan.hashtags ?? "",
              hook: plan.hook ?? "",
              imagePrompt: plan.imagePrompt ?? "",
              videoPrompt: plan.videoPrompt ?? "",
              publishDate: scheduledAt ? new Date(scheduledAt) : plan.publishDate,
              scheduledAt: scheduledAt ?? plan.publishDate?.toISOString() ?? new Date().toISOString(),
            }),
          });
          if (resp.ok) {
            let data: any = {};
            try { data = await resp.json(); } catch {}
            metricoolJobId = data?.id ?? data?.jobId ?? `make_${Date.now()}`;
          } else {
            publishError = `Make.com HTTP ${resp.status}`;
          }
        } catch (e: any) {
          publishError = e.message;
        }
      }
    }

    if (publishError) {
      return res.status(502).json({ error: `Đăng thất bại: ${publishError}` });
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
