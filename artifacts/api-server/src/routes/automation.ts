import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  automationSettingsTable,
  brandsTable,
  contentPlansTable,
  pipelineRunsTable,
  aiAgentConfigsTable,
  aiProfilesTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
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
    const { isEnabled, platforms, contentTypes, runHour, autoApprove, topicMode, customGoal } = req.body;

    const existing = await db.select().from(automationSettingsTable).where(eq(automationSettingsTable.brandId, brandId));

    if (existing.length > 0) {
      const [updated] = await db.update(automationSettingsTable)
        .set({ isEnabled, platforms, contentTypes, runHour, autoApprove, topicMode, customGoal, updatedAt: new Date() })
        .where(eq(automationSettingsTable.brandId, brandId))
        .returning();
      return res.json(updated);
    } else {
      const [created] = await db.insert(automationSettingsTable)
        .values({ brandId, isEnabled, platforms, contentTypes, runHour, autoApprove, topicMode, customGoal })
        .returning();
      return res.json(created);
    }
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

    // Send all results to Make.com webhook
    if (!dryRun && webhookUrl && results.some(r => r.ok)) {
      const successResults = results.filter(r => r.ok);
      const planIds = successResults.flatMap(r => r.plans ?? []);

      // Fetch the actual content plans to send to Make.com
      const planDetails = planIds.length > 0
        ? await db.select().from(contentPlansTable).where(
            // filter by the plan IDs
            eq(contentPlansTable.brandId, successResults[0]?.brandId)
          )
        : [];

      const webhookPayload = {
        event: "daily_automation_completed",
        timestamp: new Date().toISOString(),
        totalBrands: results.length,
        totalPlansCreated: planIds.length,
        results: successResults.map(r => ({
          brandId: r.brandId,
          brandName: r.brandName,
          trendTopic: r.trendTopic,
          plansCreated: r.plans?.length ?? 0,
          summary: r.summary,
        })),
        // Content details for Make.com to send to Metricool
        contentPlans: planIds,
      };

      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });
      } catch (e) {
        console.warn("Webhook send failed:", e);
      }
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
  const { dryRun = false } = req.body;

  try {
    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) return res.status(404).json({ error: "Brand nicht gefunden" });

    let [settings] = await db.select().from(automationSettingsTable).where(eq(automationSettingsTable.brandId, brandId));

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
        lastRunAt: null,
        lastRunStatus: null,
        lastRunSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const result = await runAutomationForBrand(brand, settings, dryRun);

    if (!dryRun && settings.id > 0) {
      await db.update(automationSettingsTable)
        .set({ lastRunAt: new Date(), lastRunStatus: "success", lastRunSummary: result.summary, updatedAt: new Date() })
        .where(eq(automationSettingsTable.brandId, brandId));
    }

    // Send to Make webhook
    const webhookUrl = process.env.MAKE_WEBHOOK_URL;
    if (!dryRun && webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "manual_automation_run",
            timestamp: new Date().toISOString(),
            brand: { id: brand.id, name: brand.brandName },
            result,
          }),
        });
      } catch {}
    }

    res.json({ ok: true, ...result, dryRun });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
