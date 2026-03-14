import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  automationSettingsTable,
  automationLogsTable,
  brandsTable,
  contentPlansTable,
  pipelineRunsTable,
  aiAgentConfigsTable,
  aiProfilesTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

const router: IRouter = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});
const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
});

// ── Helpers ────────────────────────────────────────────────────────────────────
async function callGrokJSON(prompt: string, system: string): Promise<any> {
  try {
    const r = await grok.chat.completions.create({
      model: "grok-3",
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    });
    return JSON.parse(r.choices[0]?.message?.content ?? "{}");
  } catch {
    const r = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    });
    return JSON.parse(r.choices[0]?.message?.content ?? "{}");
  }
}

async function callOpenAIJSON(prompt: string, system: string): Promise<any> {
  const r = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 3000,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
  });
  return JSON.parse(r.choices[0]?.message?.content ?? "{}");
}

async function callGeminiJSON(prompt: string): Promise<any> {
  const r = await gemini.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
  });
  return JSON.parse(r.text ?? "{}");
}

// ── Content types config ────────────────────────────────────────────────────────
const CONTENT_TYPE_CONFIG: Record<string, { label: string; description: string; platform: string }> = {
  post: { label: "Post ảnh / Caption", description: "Bài đăng thông thường với ảnh và caption", platform: "Facebook,Instagram" },
  reel: { label: "Reel / TikTok Video", description: "Script ngắn 15-60 giây cho Reel/TikTok", platform: "Instagram,TikTok" },
  story: { label: "Story (24h)", description: "Story ngắn hấp dẫn tồn tại 24 giờ", platform: "Facebook,Instagram" },
};

// ── GET /automation/settings — all brands with automation settings ───────────
router.get("/settings", async (_req, res) => {
  try {
    const brands = await db.select().from(brandsTable);
    const settings = await db.select().from(automationSettingsTable);
    const settingsMap = Object.fromEntries(settings.map(s => [s.brandId, s]));
    res.json(brands.map(b => ({
      brand: b,
      settings: settingsMap[b.id] ?? null,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /automation/settings/:brandId — upsert automation settings ──────────
router.post("/settings/:brandId", async (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const { isEnabled, platforms, contentTypes, runHour, autoApprove, topicMode, customGoal, metricoolAccountId, metricoolToken } = req.body;

    const existing = await db.select().from(automationSettingsTable).where(eq(automationSettingsTable.brandId, brandId));

    if (existing.length > 0) {
      const [updated] = await db.update(automationSettingsTable)
        .set({ isEnabled, platforms, contentTypes, runHour, autoApprove, topicMode, customGoal, metricoolAccountId, metricoolToken, updatedAt: new Date() })
        .where(eq(automationSettingsTable.brandId, brandId))
        .returning();
      return res.json(updated);
    } else {
      const [created] = await db.insert(automationSettingsTable)
        .values({ brandId, isEnabled, platforms, contentTypes, runHour, autoApprove, topicMode, customGoal, metricoolAccountId, metricoolToken })
        .returning();
      return res.json(created);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /automation/logs — recent automation run logs ─────────────────────────
router.get("/logs", async (req, res) => {
  try {
    const { brandId, limit = "50" } = req.query;

    const rows = brandId
      ? await db.select().from(automationLogsTable)
          .where(eq(automationLogsTable.brandId, parseInt(brandId as string)))
          .orderBy(automationLogsTable.runAt)
          .limit(parseInt(limit as string))
      : await db.select().from(automationLogsTable)
          .orderBy(automationLogsTable.runAt)
          .limit(parseInt(limit as string));

    res.json(rows.reverse());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /automation/test-webhook — test Make.com webhook ────────────────────
router.post("/test-webhook", async (_req, res) => {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) return res.status(400).json({ error: "MAKE_WEBHOOK_URL chưa được cấu hình trong Secrets" });
  try {
    const testPayload = {
      event: "automation_test",
      timestamp: new Date().toISOString(),
      message: "Kết nối Make.com thành công từ AI Marketing Platform!",
      sampleContent: {
        brandName: "Test Store",
        contentType: "post",
        platform: "Instagram",
        caption: "Dies ist ein Testbeitrag von AI Marketing Platform 🎉",
        hashtags: "#test #KI #Marketing",
      },
    };
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });
    res.json({ ok: r.ok, status: r.status, message: r.ok ? "Webhook test thành công!" : "Webhook phản hồi lỗi" });
  } catch (e: any) {
    res.status(500).json({ error: `Không kết nối được webhook: ${e.message}` });
  }
});

// ── Core automation runner ────────────────────────────────────────────────────
async function runAutomationForBrand(
  brand: typeof brandsTable.$inferSelect,
  settings: typeof automationSettingsTable.$inferSelect,
  dryRun = false,
): Promise<{ brandId: number; brandName: string; plans: number[]; summary: string; error?: string }> {
  const platforms = settings.platforms.split(",").map(p => p.trim()).filter(Boolean);
  const contentTypes = settings.contentTypes.split(",").map(c => c.trim()).filter(Boolean);
  const now = new Date();
  const month = now.toLocaleString("de-DE", { month: "long" });
  const dayOfWeek = now.toLocaleString("de-DE", { weekday: "long" });

  // Load agent configs
  let profileId = brand.aiProfileId ?? null;
  if (!profileId) {
    const [def] = await db.select().from(aiProfilesTable).where(eq(aiProfilesTable.isDefault, true));
    profileId = def?.id ?? null;
  }
  const agentConfigs = profileId
    ? await db.select().from(aiAgentConfigsTable).where(eq(aiAgentConfigsTable.profileId, profileId))
    : [];

  const contactBlock = [
    brand.address ? `Adresse: ${brand.address}` : null,
    brand.phone ? `Telefon: ${brand.phone}` : null,
    brand.businessHours ? `Öffnungszeiten: ${brand.businessHours}` : null,
  ].filter(Boolean).join(", ");

  // ── Step 1: Find trending topic for today (Grok) ──────────────────────────
  const trendPrompt = `Du bist ein Social-Media-Trend-Experte für den deutschen Markt.

LADEN-INFORMATION:
- Name: ${brand.brandName}
- Branche: ${brand.industry}
- Standort: ${brand.branchLocation}
- Zielgruppe: ${brand.targetAudience}
- Heute: ${dayOfWeek}, ${month} ${now.getDate()}, ${now.getFullYear()}

Finde das BESTE Trend-Thema für heute für dieses Geschäft. Gib JSON zurück:
{
  "topic": "das konkrete trending Thema für heute (z.B. 'Frühlingsnägel 2025', 'Mittagstisch Angebot', 'Late Night Special')",
  "goal": "konkretes Marketingziel (z.B. 'Mehr Laufkundschaft zwischen 11-14 Uhr', 'Neue Kunden für Gelmaker')",
  "keywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4", "Keyword5"],
  "seasonalContext": "Warum ist dieses Thema heute relevant",
  "trendScore": 82,
  "contentAngles": {
    "post": "Winkel für normalen Post",
    "reel": "Winkel für Reel/Video",
    "story": "Winkel für Story"
  }
}`;

  const trendData = await callGrokJSON(trendPrompt, "Du bist ein Experte für Echtzeit-Social-Media-Trends im deutschsprachigen Raum. Antworte nur auf Deutsch.");
  const topic = trendData.topic ?? `${brand.industry} Tagesaktion`;
  const goal = settings.customGoal ?? trendData.goal ?? "Mehr Kunden gewinnen";

  // ── Step 2: Per content type — generate content ───────────────────────────
  const savedPlanIds: number[] = [];

  for (const ct of contentTypes) {
    for (const plat of platforms) {
      // Skip invalid combos (e.g., TikTok story)
      if (ct === "story" && plat === "TikTok") continue;

      // Build content-type-specific instructions
      const ctInstructions: Record<string, string> = {
        post: `Schreibe einen vollständigen Instagram/Facebook-Post mit Hook, Story, Nutzen, CTA. 150-250 Wörter. Natürlich, ansprechend, auf Deutsch.`,
        reel: `Schreibe ein Reel/TikTok-Video-Skript (15-60 Sekunden). Format: Hook (0-3s), Hauptinhalt (3-50s), CTA (Ende). Jede Zeile ist ein neues Szene/Clip. Auf Deutsch.`,
        story: `Schreibe einen Story-Text (max 3 Slides). Jeder Slide: kurze, knallige Aussage + Emoji. Slide 3 = klarer CTA mit Sticker-Empfehlung. Auf Deutsch.`,
      };

      const contentPrompt = `Du bist ein Top-Copywriter für ${plat} im deutschsprachigen Raum.

LADEN: ${brand.brandName} | ${brand.industry} | ${brand.branchLocation}
${contactBlock ? `KONTAKT: ${contactBlock}` : ""}
ZIELGRUPPE: ${brand.targetAudience}
MARKENSTIMME: ${brand.brandVoice}

HEUTIGES THEMA: "${topic}"
ZIEL: ${goal}
CONTENT-TYP: ${ct.toUpperCase()} für ${plat}

${ctInstructions[ct] ?? ""}

TRENDING KONTEXT: ${trendData.seasonalContext ?? ""}
KEYWORDS ZU NUTZEN: ${trendData.keywords?.join(", ") ?? ""}

Gib JSON zurück (kein Markdown):
{
  "hook": "Eröffnungs-Hook der sofort Aufmerksamkeit erregt",
  "mainCaption": "Haupttext vollständig ausgeschrieben",
  "shortCaption": "Kurzversion 30-50 Wörter",
  "cta": "Konkreter Call-to-Action",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "imagePrompt": "Detailed English prompt for DALL-E image generation matching this content",
  "slideTexts": ["Slide 1 Text", "Slide 2 Text", "Slide 3 CTA"]
}

Anforderungen:
- Gesamter Content AUF DEUTSCH, natürlich und authentisch
- hashtags: 12-20 Tags (deutsch + englisch gemischt, lokal + trending)
- imagePrompt: auf Englisch, sehr detailliert für beste AI-Bildgenerierung`;

      const contentData = await callGeminiJSON(contentPrompt);

      if (!dryRun) {
        const publishDate = new Date();
        publishDate.setDate(publishDate.getDate() + 1); // schedule for tomorrow
        publishDate.setHours(9, 0, 0, 0); // 9AM by default

        const [plan] = await db.insert(contentPlansTable).values({
          brandId: brand.id,
          publishDate,
          platform: plat,
          contentType: ct,
          topic,
          hook: contentData.hook ?? "",
          caption: contentData.mainCaption ?? "",
          shortCaption: contentData.shortCaption ?? "",
          cta: contentData.cta ?? "",
          hashtags: Array.isArray(contentData.hashtags) ? contentData.hashtags.join(" ") : "",
          imagePrompt: contentData.imagePrompt ?? "",
          status: settings.autoApprove ? "approved" : "review",
        }).returning();

        savedPlanIds.push(plan.id);
      }
    }
  }

  return {
    brandId: brand.id,
    brandName: brand.brandName,
    plans: savedPlanIds,
    summary: `${savedPlanIds.length} Beiträge erstellt: ${contentTypes.join(", ")} für ${platforms.join(", ")}`,
    trendTopic: topic,
  } as any;
}

// ── POST /automation/run — main automation runner (called by Make.com) ────────
router.post("/run", async (req, res) => {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  const { brandIds, dryRun = false, secret } = req.body;

  // Optional: simple secret check for Make.com calls
  // if (secret !== process.env.AUTOMATION_SECRET) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Get all brands + their enabled automation settings
    const allBrands = await db.select().from(brandsTable);
    const allSettings = await db.select().from(automationSettingsTable).where(eq(automationSettingsTable.isEnabled, true));

    // Filter by brandIds if provided, otherwise run all enabled
    const settingsToRun = brandIds?.length
      ? allSettings.filter(s => brandIds.includes(s.brandId))
      : allSettings;

    if (settingsToRun.length === 0) {
      return res.json({ ok: true, message: "Keine aktiven Shops für Automation konfiguriert.", results: [] });
    }

    const results: any[] = [];

    for (const settings of settingsToRun) {
      const brand = allBrands.find(b => b.id === settings.brandId);
      if (!brand) continue;

      try {
        const result = await runAutomationForBrand(brand, settings, dryRun);
        results.push({ ...result, ok: true });

        // Update last run info
        if (!dryRun) {
          await db.update(automationSettingsTable)
            .set({
              lastRunAt: new Date(),
              lastRunStatus: "success",
              lastRunSummary: result.summary,
              updatedAt: new Date(),
            })
            .where(eq(automationSettingsTable.brandId, brand.id));
        }
      } catch (e: any) {
        results.push({ brandId: brand.id, brandName: brand.brandName, ok: false, error: e.message });
        if (!dryRun) {
          await db.update(automationSettingsTable)
            .set({ lastRunAt: new Date(), lastRunStatus: "error", lastRunSummary: e.message, updatedAt: new Date() })
            .where(eq(automationSettingsTable.brandId, brand.id));
        }
      }
    }

    // Send all results to Make.com webhook with FULL content details
    if (!dryRun && webhookUrl && results.some(r => r.ok)) {
      const successResults = results.filter(r => r.ok);
      const planIds = successResults.flatMap(r => r.plans ?? []);

      // Fetch full content plan details for Make.com → Metricool
      const planDetails = planIds.length > 0
        ? await db.select({
            id: contentPlansTable.id,
            brandId: contentPlansTable.brandId,
            platform: contentPlansTable.platform,
            contentType: contentPlansTable.contentType,
            topic: contentPlansTable.topic,
            caption: contentPlansTable.caption,
            shortCaption: contentPlansTable.shortCaption,
            cta: contentPlansTable.cta,
            hashtags: contentPlansTable.hashtags,
            imagePrompt: contentPlansTable.imagePrompt,
            publishDate: contentPlansTable.publishDate,
            status: contentPlansTable.status,
          })
          .from(contentPlansTable)
          .where(inArray(contentPlansTable.id, planIds))
        : [];

      const brandLookup = Object.fromEntries(successResults.map(r => [r.brandId, r.brandName]));

      // Get metricoolAccountId per brand from settings
      const metricoolLookup = Object.fromEntries(
        allSettings.map(s => [s.brandId, { accountId: s.metricoolAccountId ?? "", token: s.metricoolToken ?? "" }])
      );

      // Platform mapping to Metricool network names
      const platformMap: Record<string, string> = {
        "Facebook": "facebook",
        "Instagram": "instagram",
        "TikTok": "tiktok",
      };

      const contentDetails = planDetails.map(p => ({
        id: p.id,
        brandName: brandLookup[p.brandId] ?? "Unknown",
        metricoolAccountId: metricoolLookup[p.brandId]?.accountId ?? "",
        metricoolToken: metricoolLookup[p.brandId]?.token ?? "",
        platform: p.platform,
        metricoolNetwork: platformMap[p.platform] ?? p.platform.toLowerCase(),
        contentType: p.contentType,
        topic: p.topic,
        caption: [p.caption, p.cta].filter(Boolean).join("\n\n"),
        shortCaption: p.shortCaption ?? "",
        hashtags: p.hashtags ?? "",
        fullText: [p.caption, p.cta, p.hashtags].filter(Boolean).join("\n\n"),
        imagePrompt: p.imagePrompt ?? "",
        publishDate: p.publishDate instanceof Date ? p.publishDate.toISOString() : new Date().toISOString(),
        status: p.status,
      }));

      const webhookPayload = {
        event: "daily_automation_completed",
        timestamp: new Date().toISOString(),
        totalBrands: successResults.length,
        totalPlansCreated: planIds.length,
        results: successResults.map(r => ({
          brandId: r.brandId,
          brandName: r.brandName,
          trendTopic: r.trendTopic,
          plansCreated: r.plans?.length ?? 0,
          summary: r.summary,
        })),
        contentDetails,
      };

      let webhookOk = false;
      let webhookErrMsg = "";
      try {
        const whResp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });
        webhookOk = whResp.ok;
        if (!whResp.ok) webhookErrMsg = `HTTP ${whResp.status}`;
        console.log(`Webhook sent: ${contentDetails.length} content plans to Make.com (status: ${whResp.status})`);
      } catch (e: any) {
        webhookErrMsg = e.message;
        console.warn("Webhook send failed:", e);
      }

      // Save logs for each brand
      for (const r of successResults) {
        const brandPlanCount = r.plans?.length ?? 0;
        await db.insert(automationLogsTable).values({
          brandId: r.brandId,
          brandName: r.brandName,
          status: "success",
          plansCreated: brandPlanCount,
          webhookSent: true,
          webhookStatus: webhookOk ? "success" : "failed",
          webhookError: webhookErrMsg || null,
          details: {
            trendTopic: r.trendTopic,
            summary: r.summary,
            contentIds: r.plans ?? [],
          },
        });
      }
    }

    // Save error logs for failed brands (outside webhook block)
    for (const r of results.filter(r => !r.ok)) {
      await db.insert(automationLogsTable).values({
        brandId: r.brandId,
        brandName: r.brandName,
        status: "error",
        plansCreated: 0,
        webhookSent: false,
        webhookStatus: "not_sent",
        errorMessage: r.error ?? "Unknown error",
      }).catch(() => {});
    }

    res.json({
      ok: true,
      dryRun,
      totalBrands: results.length,
      totalPlansCreated: results.reduce((sum, r) => sum + (r.plans?.length ?? 0), 0),
      results,
    });
  } catch (e: any) {
    console.error("Automation run error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /automation/run/:brandId — run for single brand manually ─────────────
router.post("/run/:brandId", async (req, res) => {
  const brandId = parseInt(req.params.brandId);
  const { dryRun = false, testMode = false, metricoolAccountId: bodyMetricoolId, metricoolToken: bodyMetricoolToken } = req.body;

  try {
    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) return res.status(404).json({ error: "Brand nicht gefunden" });

    let [settings] = await db.select().from(automationSettingsTable).where(eq(automationSettingsTable.brandId, brandId));

    // Merge incoming metricool credentials (from UI form, may not be saved yet)
    if (settings && (bodyMetricoolId !== undefined || bodyMetricoolToken !== undefined)) {
      settings = {
        ...settings,
        metricoolAccountId: bodyMetricoolId ?? settings.metricoolAccountId,
        metricoolToken: bodyMetricoolToken ?? settings.metricoolToken,
      };
    }

    // Use defaults if no settings configured yet
    if (!settings) {
      settings = {
        id: 0,
        brandId,
        isEnabled: true,
        platforms: "Facebook,Instagram",
        contentTypes: "post,reel,story",
        runHour: 17,
        autoApprove: false,
        topicMode: "auto",
        customGoal: null,
        metricoolAccountId: null,
        metricoolToken: null,
        lastRunAt: null,
        lastRunStatus: null,
        lastRunSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Test mode: limit to 1 Facebook post, but KEEP user's autoApprove setting
    const runSettings = testMode
      ? { ...settings, platforms: "Facebook", contentTypes: "post" }
      : settings;

    const result = await runAutomationForBrand(brand, runSettings, dryRun);

    if (!dryRun && settings.id > 0) {
      await db.update(automationSettingsTable)
        .set({ lastRunAt: new Date(), lastRunStatus: "success", lastRunSummary: result.summary, updatedAt: new Date() })
        .where(eq(automationSettingsTable.brandId, brandId));
    }

    // Send content to Metricool (direct) or Make.com webhook fallback
    const webhookUrl = process.env.MAKE_WEBHOOK_URL;
    const mcToken = runSettings.metricoolToken;
    const mcUserId = runSettings.metricoolAccountId;
    let webhookOk = false;
    let webhookErrMsg = "";
    let deliveryMethod = "not_configured";

    if (!dryRun && result.plans?.length > 0 && runSettings.autoApprove) {
      // Only post to Metricool/Make.com if autoApprove is enabled
      // (when autoApprove=false, content waits in Phê duyệt queue)
      const planDetails = await db.select({
        id: contentPlansTable.id,
        platform: contentPlansTable.platform,
        caption: contentPlansTable.caption,
        cta: contentPlansTable.cta,
        hashtags: contentPlansTable.hashtags,
        publishDate: contentPlansTable.publishDate,
      }).from(contentPlansTable).where(inArray(contentPlansTable.id, result.plans));

      if (mcToken && mcUserId) {
        // ── DIRECT METRICOOL API ──────────────────────────────────────────────
        deliveryMethod = "metricool_direct";
        let successCount = 0;
        const errors: string[] = [];

        // Group posts by scheduled time (stagger by 5 min each)
        let offsetMin = 60;
        for (const plan of planDetails) {
          try {
            const fullText = [plan.caption, plan.cta, plan.hashtags].filter(Boolean).join("\n\n");
            const future = new Date(Date.now() + offsetMin * 60 * 1000);
            const dt = future.toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).replace(" ", "T");
            const mcResult = await mcSchedulePost({
              userId: String(mcUserId),
              token: mcToken,
              text: fullText,
              networks: [plan.platform.toLowerCase()],
              scheduledAt: dt,
              timezone: "Europe/Berlin",
            });
            if (mcResult.ok) successCount++;
            else errors.push(`${plan.platform}: ${mcResult.hint ?? mcResult.status}`);
            offsetMin += 5;
          } catch (e: any) {
            errors.push(`${plan.platform}: ${e.message}`);
          }
        }

        webhookOk = successCount > 0;
        webhookErrMsg = errors.join("; ");
        console.log(`[direct-metricool] ${successCount}/${planDetails.length} posts scheduled. Errors: ${webhookErrMsg}`);

      } else if (webhookUrl) {
        // ── MAKE.COM WEBHOOK FALLBACK ─────────────────────────────────────────
        deliveryMethod = "make_webhook";
        try {
          const platformMap: Record<string, string> = { "Facebook": "facebook", "Instagram": "instagram", "TikTok": "tiktok" };
          const contentDetails = planDetails.map(p => ({
            id: p.id,
            brandName: brand.brandName,
            metricoolAccountId: mcUserId ?? "",
            metricoolToken: mcToken ?? "",
            platform: p.platform,
            metricoolNetwork: platformMap[p.platform] ?? p.platform.toLowerCase(),
            fullText: [p.caption, p.cta, p.hashtags].filter(Boolean).join("\n\n"),
            publishDate: p.publishDate instanceof Date ? p.publishDate.toISOString() : new Date().toISOString(),
          }));
          const whResp = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "manual_run", timestamp: new Date().toISOString(), contentDetails }),
          });
          webhookOk = whResp.ok;
          if (!whResp.ok) webhookErrMsg = `HTTP ${whResp.status}`;
        } catch (e: any) {
          webhookErrMsg = e.message;
        }
      }
    }

    // Save log
    if (!dryRun) {
      await db.insert(automationLogsTable).values({
        brandId: brand.id,
        brandName: brand.brandName,
        status: "success",
        plansCreated: result.plans?.length ?? 0,
        webhookSent: (mcToken && mcUserId) || !!webhookUrl ? true : false,
        webhookStatus: webhookOk ? "success" : (deliveryMethod === "not_configured" ? "not_configured" : "failed"),
        webhookError: webhookErrMsg || null,
        details: {
          trendTopic: result.trendTopic,
          summary: result.summary,
          contentIds: result.plans ?? [],
          deliveryMethod,
        },
      }).catch(() => {});
    }

    res.json({ ok: true, ...result, dryRun });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Metricool API helpers ─────────────────────────────────────────────────────

/** Fetch simpleProfiles to get internal brandId + network account IDs.
 *  Pass targetBlogId to pick a specific brand (else returns all). */
async function mcGetProfiles(userId: string, token: string): Promise<any[]> {
  // Call with userId as both params — returns ALL brands for this account
  const r = await fetch(
    `https://app.metricool.com/api/admin/simpleProfiles?userId=${userId}&blogId=${userId}`,
    { headers: { "X-Mc-Auth": token } }
  );
  if (!r.ok) throw new Error(`simpleProfiles HTTP ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

/** Find the correct Metricool profile. 
 *  metricoolAccountId can be: the userId, or the internal brand ID (preferred). */
async function mcFindProfile(metricoolAccountId: string, token: string): Promise<any> {
  const userId = metricoolAccountId; // We'll use as userId to list all brands
  const profiles = await mcGetProfiles(userId, token);
  if (!profiles.length) throw new Error("Không tìm thấy brand nào trong Metricool");
  // If metricoolAccountId matches a specific brand id, use that brand
  const exactMatch = profiles.find(p => String(p.id) === String(metricoolAccountId));
  if (exactMatch) return exactMatch;
  // Otherwise return first brand
  return profiles[0];
}

const MC_NETWORK_MAP: Record<string, string> = {
  facebook: "FACEBOOK",
  instagram: "INSTAGRAM",
  tiktok: "TIKTOK",
  twitter: "TWITTER",
  linkedin: "LINKEDIN",
  youtube: "YOUTUBE",
};

/**
 * Schedule a post directly to Metricool using the correct API format.
 * userId = metricoolAccountId field (user's numeric Metricool ID)
 */
async function mcSchedulePost(opts: {
  userId: string;
  token: string;
  text: string;
  networks: string[];          // e.g. ["facebook","instagram"]
  scheduledAt?: string;        // ISO datetime local (Europe/Berlin)
  timezone?: string;
}): Promise<{ ok: boolean; status: number; data?: any; hint?: string }> {
  const { userId, token, text, networks, timezone = "Europe/Berlin" } = opts;

  // 1. Find the correct brand profile by userId/brandId
  let profile: any;
  try {
    profile = await mcFindProfile(userId, token);
  } catch (e: any) {
    return { ok: false, status: 401, hint: e.message };
  }
  const internalBlogId = profile.id;
  const realUserId = profile.userId ?? profile.ownerUserId ?? userId;

  // 2. Build providers array based on requested networks
  const providers: any[] = [];
  for (const net of networks) {
    const mcNet = MC_NETWORK_MAP[net.toLowerCase()];
    if (!mcNet) continue;
    // Get the network account ID from the profile
    let accountId: string | null = null;
    if (net.toLowerCase() === "facebook" && profile.facebookPageId) accountId = profile.facebookPageId;
    else if (net.toLowerCase() === "instagram" && profile.fbBusinessId) accountId = profile.fbBusinessId;
    else if (net.toLowerCase() === "tiktok" && profile.tiktok) accountId = profile.tiktok;
    if (accountId) providers.push({ network: mcNet, id: accountId });
  }

  if (!providers.length) {
    // Fallback: try facebook with facebookPageId
    if (profile.facebookPageId) {
      providers.push({ network: "FACEBOOK", id: profile.facebookPageId });
    } else {
      return { ok: false, status: 400, hint: "Không tìm thấy tài khoản mạng xã hội nào được kết nối trong Metricool." };
    }
  }

  // 3. Build date — use Berlin local time, minimum 60 min in the future
  let dt: string;
  if (opts.scheduledAt) {
    dt = opts.scheduledAt.slice(0, 19);
  } else {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    // toLocaleString("sv-SE") gives "2026-03-14 12:00:00" which is ISO-like
    dt = future.toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).replace(" ", "T");
  }

  const payload = {
    text,
    publicationDate: { dateTime: dt, timezone },
    providers,
    autoPublish: true,
  };

  console.log("[mcSchedulePost] userId=%s blogId=%s payload=%s", userId, internalBlogId, JSON.stringify(payload));

  const mcRes = await fetch(
    `https://app.metricool.com/api/v2/scheduler/posts?userId=${realUserId}&blogId=${internalBlogId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Mc-Auth": token },
      body: JSON.stringify(payload),
    }
  );

  const mcText = await mcRes.text();
  let mcData: any;
  try { mcData = JSON.parse(mcText); } catch { mcData = { raw: mcText.slice(0, 500) }; }
  console.log("[mcSchedulePost] response:", mcRes.status, mcText.slice(0, 300));

  if (!mcRes.ok) {
    let hint = "";
    if (mcRes.status === 401) hint = "Token không hợp lệ hoặc hết hạn. Vào Metricool → Settings → API → Generate Token mới.";
    else if (mcRes.status === 403) hint = "Token không có quyền đăng bài.";
    else if (mcRes.status === 404) hint = "Blog không tìm thấy (blogId=" + internalBlogId + ")";
    else if (mcRes.status === 422) hint = "Dữ liệu không hợp lệ: " + JSON.stringify(mcData).slice(0, 200);
    else hint = JSON.stringify(mcData).slice(0, 200);
    return { ok: false, status: mcRes.status, data: mcData, hint };
  }
  return { ok: true, status: mcRes.status, data: mcData };
}

// ── GET /automation/metricool-brands — list all Metricool brands for a token ─────────────
router.get("/metricool-brands", async (req, res) => {
  const { userId, token } = req.query as { userId?: string; token?: string };
  if (!userId || !token) return res.status(400).json({ ok: false, error: "Thiếu userId hoặc token" });
  try {
    const profiles = await mcGetProfiles(userId, token);
    const brands = profiles
      .filter(p => p.id && p.label)
      .map(p => ({
        id: p.id,
        label: p.label,
        facebook: p.facebookPageId ?? null,
        instagram: p.instagram ?? null,
        tiktok: p.tiktok ?? null,
      }));
    return res.json({ ok: true, userId: profiles[0]?.userId ?? userId, brands });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /automation/test-metricool/:brandId — direct Metricool ping (bypass Make.com) ─────
router.post("/test-metricool/:brandId", async (req, res) => {
  const { blogId: userId, metricoolToken, text, scheduledAt } = req.body;

  if (!userId) return res.status(400).json({ ok: false, error: "Thiếu User ID (blogId field)" });
  if (!metricoolToken) return res.status(400).json({ ok: false, error: "Thiếu Metricool API Token" });

  const caption = text ?? "✅ Test von AI Marketer — Verbindung erfolgreich! #KIMarketing";

  try {
    const result = await mcSchedulePost({
      userId: String(userId),
      token: metricoolToken,
      text: caption,
      networks: ["facebook"],
      scheduledAt,
      timezone: "Europe/Berlin",
    });
    return res.json({ ok: result.ok, status: result.status, hint: result.hint, metricoolResponse: result.data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GET /automation/blueprint — serve importable Make.com blueprint ───────────
router.get("/blueprint", (_req, res) => {
  const blueprint = {
    name: "🤖 AI Marketing Platform – Daily Auto Post",
    flow: [
      {
        id: 1,
        module: "gateway:CustomWebHook",
        version: 1,
        parameters: { hook: 0, maxResults: 1 },
        mapper: {},
        metadata: {
          designer: { x: 0, y: 0, name: "📥 Receive from AI Marketing App" },
          restore: { hook: { label: "AI Marketing – Daily Content" } },
        },
      },
      {
        id: 2,
        module: "builtin:BasicIterator",
        version: 1,
        parameters: {},
        mapper: { array: "{{1.contentDetails}}" },
        metadata: {
          designer: { x: 300, y: 0, name: "🔁 Loop each content plan" },
        },
      },
      {
        id: 3,
        module: "http:ActionSendData",
        version: 3,
        parameters: { handleErrors: true, useNewZLibDecompression: true },
        mapper: {
          url: "https://app.metricool.com/api/v2/planning",
          method: "POST",
          headers: [
            {
              name: "Authorization",
              value: "Bearer REPLACE_WITH_METRICOOL_API_TOKEN",
            },
            { name: "Content-Type", value: "application/json" },
          ],
          bodyType: "raw",
          contentType: "application/json",
          body: JSON.stringify({
            blogId: "{{2.value.metricoolAccountId}}",
            text: "{{2.value.fullText}}",
            date: "{{2.value.publishDate}}",
            networks: [{ type: "{{2.value.metricoolNetwork}}" }],
          }),
        },
        metadata: {
          designer: { x: 600, y: 0, name: "📅 Schedule in Metricool" },
        },
      },
    ],
    metadata: {
      instant: true,
      version: 1,
      scenario: {
        roundtrips: 1,
        maxErrors: 3,
        autoCommit: true,
        autoCommitTriggerLast: true,
        sequential: true,
        confidential: false,
        dataloss: false,
        dlq: false,
        freshVariables: false,
      },
      designer: { orphans: [] },
      zone: "eu2.make.com",
    },
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="ai-marketing-make-blueprint.json"'
  );
  res.json(blueprint);
});

export default router;
