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
  scheduledJobsTable,
  scheduledRunsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { triggerJobNow } from "../jobs/scheduler";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { buildImagePromptGuidance } from "../lib/imagePromptBuilder";

const router: IRouter = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
});

// ── Helpers ────────────────────────────────────────────────────────────────────
// Trend research for the daily automation runner (GPT-4o).
async function callTrendJSON(prompt: string, system: string): Promise<any> {
  const r = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
  });
  return JSON.parse(r.choices[0]?.message?.content ?? "{}");
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

// Normalize content JSON — handle Gemini returning array, wrong field names, nested structures
function normalizeContentJSON(raw: any): any {
  if (!raw || typeof raw !== "object") return {};
  let data = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  // Unwrap single-key nested objects (e.g., { CONTENT_IDEA_1: { ... } })
  const keys = Object.keys(data);
  if (keys.length === 1 && typeof data[keys[0]] === "object" && !Array.isArray(data[keys[0]])) {
    const inner = data[keys[0]];
    const hasContentFields = ["hook", "hooks", "mainCaption", "caption", "CAPTION", "HOOK"].some(f => f in inner);
    if (hasContentFields) data = inner;
  }
  // Pick hook: prefer string, fall back to first array element
  const hookRaw = data.hook ?? data.HOOK ?? data.hooks ?? data.HOOKS;
  const hook = typeof hookRaw === "string" ? hookRaw :
                (Array.isArray(hookRaw) && hookRaw.length > 0 ? hookRaw[0] : "");
  // Normalize hashtags
  const hashtagsRaw = data.hashtags ?? data.HASHTAGS ?? data.tags ?? [];
  const hashtags = Array.isArray(hashtagsRaw)
    ? hashtagsRaw.filter((v: any) => typeof v === "string")
    : typeof hashtagsRaw === "string" ? hashtagsRaw.split(/\s+/).filter((v: string) => v.startsWith("#")) : [];
  return {
    hook,
    mainCaption: data.mainCaption ?? data.CAPTION ?? data.caption ?? data.mainContent ?? "",
    shortCaption: data.shortCaption ?? data.SHORT_CAPTION ?? "",
    cta: data.cta ?? data.CTA ?? data.callToAction ?? "",
    hashtags,
    imagePrompt: data.imagePrompt ?? data.IMAGE_PROMPT ?? "",
  };
}

async function callGeminiJSON(prompt: string): Promise<any> {
  try {
    const r = await gemini.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });
    const text = r.text;
    if (!text) throw new Error("Gemini returned empty response");
    const parsed = JSON.parse(text);
    const normalized = normalizeContentJSON(parsed);
    // Validate: if mainCaption is too short, fall back to GPT-4o
    if (!normalized.mainCaption || normalized.mainCaption.length < 20) {
      throw new Error(`Gemini returned incomplete content (mainCaption missing). Keys: ${JSON.stringify(Object.keys(parsed))}`);
    }
    return normalized;
  } catch (err: any) {
    console.warn("Gemini content failed, falling back to GPT-4o:", err?.message);
    const r = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const parsed = JSON.parse(r.choices[0]?.message?.content ?? "{}");
    return normalizeContentJSON(parsed);
  }
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
    return res.status(500).json({ error: e.message });
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

// ── POST /automation/test-webhook — test the outbound webhook ────────────────
router.post("/test-webhook", async (_req, res) => {
  const webhookUrl = process.env.OUTBOUND_WEBHOOK_URL;
  if (!webhookUrl) return res.status(400).json({ error: "OUTBOUND_WEBHOOK_URL chưa được cấu hình trong Secrets" });
  try {
    const testPayload = {
      event: "automation_test",
      timestamp: new Date().toISOString(),
      message: "Kết nối webhook thành công từ AI Marketing Platform!",
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
    return res.json({ ok: r.ok, status: r.status, message: r.ok ? "Webhook test thành công!" : "Webhook phản hồi lỗi" });
  } catch (e: any) {
    return res.status(500).json({ error: `Không kết nối được webhook: ${e.message}` });
  }
});

// ── Core automation runner ────────────────────────────────────────────────────
async function runAutomationForBrand(
  brand: typeof brandsTable.$inferSelect,
  settings: typeof automationSettingsTable.$inferSelect,
  dryRun = false,
): Promise<{ brandId: number; brandName: string; plans: number[]; summary: string; trendTopic: string; error?: string }> {
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

  // ── Step 1: Find trending topic for today ─────────────────────────────────
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

  const trendData = await callTrendJSON(trendPrompt, "Du bist ein Experte für Echtzeit-Social-Media-Trends im deutschsprachigen Raum. Antworte nur auf Deutsch.");
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

      const contactInfo = [
        brand.address ?? "",
        brand.phone ? `📞 ${brand.phone}` : "",
        brand.businessHours ? `🕐 ${brand.businessHours}` : "",
      ].filter(Boolean).join(" | ");

      const contentPrompt = `Du bist ein professioneller ${plat}-Texter für ein deutsches Kleinunternehmen.

GESCHÄFT: ${brand.brandName} | ${brand.industry} | ${brand.branchLocation}
ZIELGRUPPE: ${brand.targetAudience}
MARKENSTIMME: ${brand.brandVoice}
THEMA HEUTE: "${topic}"
ZIEL: ${goal}
TRENDING KONTEXT: ${trendData.seasonalContext ?? ""}

WICHTIGE REGELN — UNBEDINGT EINHALTEN:
1. KEINE Marketing-Framework-Labels im Text — verboten sind: "Attention:", "Interest:", "Desire:", "Action:", "Hook:", "Value:", "CTA:", "Problem:", "Agitate:", "Solution:", "Story:", "Challenge:", "Before:", "After:", "Bridge:", "Feature:", "Benefit:", "Step 1:", "Schritt 1:", "Phase 1:", oder jegliche anderen Struktur-Labels oder Annotationen. Der Text muss wie ein echter Social-Media-Post klingen, nicht wie eine Marketing-Vorlage.
2. Text ist ein natürlicher Social-Media-Post — wie ein Mensch schreibt, nicht wie eine Vorlage
3. Kontaktdaten NICHT in mainCaption einfügen — werden automatisch hinzugefügt
4. Keine Klammern, keine [Platzhalter], keine Erklärungen in Klammern
5. ${ctInstructions[ct] ?? "Normaler Post, 150-250 Wörter"}

POST-FORMAT (exakt so aufbauen):
- Zeile 1: Starker Eröffnungssatz / Headline (1 Zeile, packt sofort)
- Leerzeile
- Haupttext: 3-5 kurze Absätze, natürlich erzählt, Mehrwert für den Leser
- Leerzeile  
- Klarer Call-to-Action (z.B. "Jetzt Tisch reservieren!", "Termin buchen!")

Gib JSON zurück (kein Markdown, keine Erklärungen außerhalb des JSON):
{
  "hook": "Starker Eröffnungssatz (1 Zeile)",
  "mainCaption": "Vollständiger Post-Text im beschriebenen Format — NUR der Text, ohne Kontaktdaten, ohne AIDA-Labels",
  "shortCaption": "Kurzversion 30-50 Wörter",
  "cta": "Konkreter Handlungsaufruf (1 Satz)",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "imagePrompt": "..."
}

hashtags: 12-18 Tags gemischt deutsch+englisch, lokal relevant für ${brand.branchLocation}

FÜR IMAGEPROMPT — FOLGE DIESER ANLEITUNG EXAKT:
${buildImagePromptGuidance(brand, topic)}`;

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
  };
}

// ── POST /automation/run — main automation runner ────────────────────────────
router.post("/run", async (req, res) => {
  const webhookUrl = process.env.OUTBOUND_WEBHOOK_URL;
  const { brandIds, dryRun = false, secret } = req.body;

  // Optional: simple secret check for outbound automation calls
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

    // Send all results to the outbound webhook with FULL content details
    if (!dryRun && webhookUrl && results.some(r => r.ok)) {
      const successResults = results.filter(r => r.ok);
      const planIds = successResults.flatMap(r => r.plans ?? []);

      // Fetch full content plan details for the outbound webhook → Metricool
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
        console.log(`Webhook sent: ${contentDetails.length} content plans to outbound webhook (status: ${whResp.status})`);
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

    return res.json({
      ok: true,
      dryRun,
      totalBrands: results.length,
      totalPlansCreated: results.reduce((sum, r) => sum + (r.plans?.length ?? 0), 0),
      results,
    });
  } catch (e: any) {
    console.error("Automation run error:", e);
    return res.status(500).json({ ok: false, error: e.message });
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

    // Send content to Metricool (direct) or the outbound webhook fallback
    const webhookUrl = process.env.OUTBOUND_WEBHOOK_URL;
    const mcToken = runSettings.metricoolToken;
    const mcUserId = runSettings.metricoolAccountId;
    let webhookOk = false;
    let webhookErrMsg = "";
    let deliveryMethod = "not_configured";

    if (!dryRun && result.plans?.length > 0 && runSettings.autoApprove) {
      // Only post to Metricool / outbound webhook if autoApprove is enabled
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
        // ── OUTBOUND WEBHOOK FALLBACK ─────────────────────────────────────────
        deliveryMethod = "outbound_webhook";
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

    return res.json({ ok: true, ...result, dryRun });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
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

// ── POST /automation/test-metricool/:brandId — direct Metricool ping ─────
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

// ── Phase 5a — Scheduled jobs catalog + audit log ──────────────────────────
// These endpoints power the /automation page panel for the cron-driven jobs
// (currently just the weekly trend digest, but extensible).

router.get("/scheduled-jobs", async (_req, res) => {
  try {
    const jobs = await db
      .select()
      .from(scheduledJobsTable)
      .orderBy(scheduledJobsTable.jobKey);
    return res.json(jobs);
  } catch (e) {
    console.error("[scheduled-jobs list]", e);
    return res
      .status(500)
      .json({ error: "Lỗi máy chủ khi load scheduled jobs" });
  }
});

router.patch("/scheduled-jobs/:jobKey", async (req, res) => {
  try {
    const { jobKey } = req.params;
    const body = req.body as {
      enabled?: boolean;
      cronExpression?: string;
      config?: Record<string, unknown>;
    };

    const patch: Partial<typeof scheduledJobsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.cronExpression === "string") {
      patch.cronExpression = body.cronExpression;
    }
    if (body.config !== undefined) patch.config = body.config;

    const [updated] = await db
      .update(scheduledJobsTable)
      .set(patch)
      .where(eq(scheduledJobsTable.jobKey, jobKey))
      .returning();

    if (!updated) return res.status(404).json({ error: "Job not found" });
    return res.json(updated);
  } catch (e) {
    console.error("[scheduled-jobs patch]", e);
    return res
      .status(500)
      .json({ error: "Lỗi máy chủ khi update scheduled job" });
  }
});

router.post("/scheduled-jobs/:jobKey/trigger", async (req, res) => {
  try {
    const { jobKey } = req.params;
    // Fire-and-forget — return immediately so the UI doesn't hang while
    // the AI runs for ~10-20s × N brands. The audit row appears in
    // /scheduled-runs as soon as the runner starts.
    triggerJobNow(jobKey).catch((e) => {
      console.error(`[scheduled-jobs trigger] ${jobKey} threw:`, e);
    });
    return res.json({ ok: true, message: "Triggered. Watch /scheduled-runs for status." });
  } catch (e) {
    console.error("[scheduled-jobs trigger]", e);
    return res
      .status(500)
      .json({ error: "Lỗi máy chủ khi trigger job" });
  }
});

router.get("/scheduled-runs", async (req, res) => {
  try {
    const jobKey = req.query.jobKey as string | undefined;
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 20, 1),
      200,
    );
    const rows = await db
      .select()
      .from(scheduledRunsTable)
      .where(jobKey ? eq(scheduledRunsTable.jobKey, jobKey) : undefined)
      .orderBy(desc(scheduledRunsTable.startedAt))
      .limit(limit);
    return res.json(rows);
  } catch (e) {
    console.error("[scheduled-runs list]", e);
    return res
      .status(500)
      .json({ error: "Lỗi máy chủ khi load scheduled runs" });
  }
});

export default router;
