import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { pipelineRunsTable, contentPlansTable, brandsTable, aiAgentConfigsTable, aiProfilesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { buildImagePromptGuidance } from "../lib/imagePromptBuilder";

const router: IRouter = Router();

const MARKETING_MODELS = [
  {
    id: "AIDA",
    name: "AIDA",
    fullName: "Attention – Interest – Desire – Action",
    description: "Mô hình kinh điển mô tả hành trình tâm lý khách hàng từ khi thấy quảng cáo đến khi mua hàng.",
    whenToUse: "Ra mắt sản phẩm mới, quảng cáo trả phí, bài đăng cần chuyển đổi ngay.",
    steps: ["Attention: Thu hút sự chú ý bằng hook mạnh", "Interest: Tạo sự thú vị bằng lợi ích", "Desire: Kích thích mong muốn sở hữu", "Action: Kêu gọi hành động rõ ràng"],
    example: "🔥 Mệt mỏi với da dầu mụn? (A) → Serum X giúp da se khít trong 7 ngày (I) → Hàng nghìn khách đã thành công (D) → Đặt ngay hôm nay giảm 30% (A)",
  },
  {
    id: "STP",
    name: "STP",
    fullName: "Segmentation – Targeting – Positioning",
    description: "Phân khúc thị trường, chọn khách hàng mục tiêu, định vị thương hiệu khác biệt.",
    whenToUse: "Xây dựng thương hiệu mới, thâm nhập thị trường, tái định vị thương hiệu.",
    steps: ["Segmentation: Chia thị trường thành nhóm rõ ràng", "Targeting: Chọn nhóm có tiềm năng nhất", "Positioning: Định vị khác biệt trong tâm trí khách hàng"],
    example: "Nhóm mẹ bỉm sữa 25-35 tuổi (S) → Mẹ bận rộn cần tiết kiệm thời gian (T) → 'Ăn ngon như nhà hàng, nhanh như cơm hộp' (P)",
  },
  {
    id: "4P",
    name: "4P / 7P",
    fullName: "Product – Price – Place – Promotion (+ People, Process, Physical Evidence)",
    description: "Marketing mix toàn diện, đặc biệt phù hợp với dịch vụ (7P).",
    whenToUse: "Lập kế hoạch marketing tổng thể, dịch vụ F&B, spa, nail salon.",
    steps: ["Product: Sản phẩm/dịch vụ nổi bật gì", "Price: Định giá và khuyến mãi", "Place: Kênh phân phối và địa điểm", "Promotion: Cách tiếp thị và truyền thông", "People: Đội ngũ và chất lượng phục vụ", "Process: Quy trình trải nghiệm khách hàng", "Physical Evidence: Bằng chứng hữu hình"],
    example: "Nail salon: dịch vụ 3D art độc đáo, giá 200k-500k, khu vực Q.1, IG showcase, KTV tay nghề 5 năm",
  },
  {
    id: "FUNNEL",
    name: "Marketing Funnel",
    fullName: "Awareness → Consideration → Conversion → Retention → Advocacy",
    description: "Phễu marketing theo dõi hành trình khách hàng qua các giai đoạn.",
    whenToUse: "Kế hoạch content dài hạn, nuôi dưỡng khách hàng tiềm năng.",
    steps: ["ToFu (Top): Nội dung giáo dục, brand awareness rộng rãi", "MoFu (Middle): So sánh, đánh giá, case study", "BoFu (Bottom): Khuyến mãi, testimonial, mời dùng thử", "Retention: Chăm sóc khách hàng cũ", "Advocacy: Kích thích review và giới thiệu"],
    example: "Tháng 1: Video hướng dẫn (ToFu) → Tháng 2: So sánh với đối thủ (MoFu) → Tháng 3: Flash sale 50% (BoFu)",
  },
  {
    id: "HOOK_VALUE_CTA",
    name: "Hook – Value – CTA",
    fullName: "Hook → Value Delivery → Call to Action",
    description: "Công thức content viral cho short-form video (Reels, TikTok).",
    whenToUse: "TikTok, Instagram Reels, video ngắn dưới 60 giây.",
    steps: ["Hook (0-3s): Câu mở đầu shock, gây tò mò hoặc pain point", "Value (3-50s): Cung cấp giá trị thực sự, giải pháp, bí quyết", "CTA (cuối): Hành động cụ thể: follow, comment, click link bio"],
    example: "🤯 Tôi kiếm 50tr/tháng nhờ 1 công thức (Hook) → [Giải thích chi tiết 45s] (Value) → Follow để nhận thêm! (CTA)",
  },
  {
    id: "CONTENT_PILLARS",
    name: "Content Pillars",
    fullName: "Các trụ cột nội dung thương hiệu",
    description: "Xác định 4-6 chủ đề cốt lõi để xây dựng content nhất quán và có chiều sâu.",
    whenToUse: "Kế hoạch content 30 ngày, xây dựng thương hiệu cá nhân, organic growth.",
    steps: ["Định nghĩa 4-6 content pillars phù hợp thương hiệu", "Phân bổ 80% content vào pillars, 20% promotional", "Xoay vòng đều các pillar trong lịch đăng bài", "Đo lường pillar nào hiệu quả nhất để tập trung"],
    example: "Nail salon: Giáo dục (nail care tips), Showcase (bộ sưu tập), Behind the scenes, Khuyến mãi, Testimonial",
  },
  {
    id: "PROBLEM_SOLUTION",
    name: "Problem – Solution",
    fullName: "Vấn đề → Khuếch đại → Giải pháp",
    description: "Chạm đúng pain point, khuếch đại nỗi đau, rồi xuất hiện như người giải cứu.",
    whenToUse: "Quảng cáo sản phẩm giải quyết vấn đề cụ thể, remarketing.",
    steps: ["Problem: Nêu vấn đề khách hàng đang gặp phải", "Agitate: Khuếch đại nỗi đau, hậu quả nếu không giải quyết", "Solution: Giới thiệu giải pháp của bạn rõ ràng"],
    example: "Tóc hư tổn rụng nhiều? → Nếu không điều trị, bạn sẽ hối hận khi nhìn gương → Liệu trình phục hồi tóc 4 tuần của chúng tôi...",
  },
  {
    id: "SOCIAL_PROOF",
    name: "Social Proof",
    fullName: "Bằng chứng xã hội & Hiệu ứng đám đông",
    description: "Sử dụng đánh giá, con số, câu chuyện khách hàng để xây dựng niềm tin.",
    whenToUse: "Xây dựng uy tín thương hiệu mới, tăng tỷ lệ chuyển đổi, re-targeting.",
    steps: ["Số liệu ấn tượng: '1000+ khách hài lòng'", "Testimonial thực: trích dẫn review khách hàng", "Before/After: hình ảnh kết quả trực quan", "Badge và chứng nhận uy tín"],
    example: "⭐⭐⭐⭐⭐ 'Làm nail ở đây lần đầu mà ghiền luôn' - Chị Lan (Q.3) | 500+ review 5 sao trên Google",
  },
  {
    id: "STORYTELLING",
    name: "Storytelling",
    fullName: "Kể chuyện thương hiệu & Emotional Connection",
    description: "Xây dựng kết nối cảm xúc sâu sắc qua câu chuyện thật, hành trình, giá trị.",
    whenToUse: "Brand building dài hạn, kết nối cảm xúc, nội dung đa nền tảng.",
    steps: ["Nhân vật: founder, khách hàng tiêu biểu, hoặc chính thương hiệu", "Xung đột: khó khăn, thách thức đã vượt qua", "Hành trình: quá trình phấn đấu có thật", "Kết quả: thành quả và bài học", "Kêu gọi: kết nối cộng đồng"],
    example: "Từ cô gái quê ra Sài Gòn với 500k trong túi → 5 năm học nghề nail → Giờ có tiệm riêng 15 thợ...",
  },
  {
    id: "FOMO",
    name: "FOMO",
    fullName: "Fear Of Missing Out – Sợ bỏ lỡ cơ hội",
    description: "Tạo cảm giác khan hiếm, giới hạn thời gian, độc quyền để thúc đẩy hành động ngay.",
    whenToUse: "Flash sale, limited edition, sự kiện, khuyến mãi cuối mùa.",
    steps: ["Giới hạn thời gian: 'Chỉ còn 24 giờ'", "Giới hạn số lượng: 'Chỉ còn 10 suất'", "Độc quyền: 'Chỉ dành cho khách VIP'", "Countdown timer hoặc số người đang xem"],
    example: "⏰ Chỉ còn 3 SUẤT cuối tháng 3! Giảm 40% liệu trình tóc cao cấp. Đặt ngay trước 23:59 hôm nay!",
  },
];

// ── OpenAI (Strategy + Prompt Generator) ──────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Grok / xAI (Trend Research) ───────────────────────────────────────────────
const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

const BASE_SYSTEM_JSON = "Luôn trả về JSON hợp lệ theo đúng cấu trúc yêu cầu, không có markdown hay code block.";

function buildSystemPrompt(agentConfig: any, baseRole: string): string {
  const parts = [baseRole];
  if (agentConfig?.expertiseArea?.trim()) {
    parts.push(`Chuyên môn đặc biệt: ${agentConfig.expertiseArea}`);
  }
  if (agentConfig?.customInstructions?.trim()) {
    parts.push(`Hướng dẫn bổ sung: ${agentConfig.customInstructions}`);
  }
  if (agentConfig?.outputStyle?.trim()) {
    parts.push(`Phong cách output: ${agentConfig.outputStyle}`);
  }
  parts.push(BASE_SYSTEM_JSON);
  return parts.join("\n\n");
}

// Helper: safely parse JSON, strip markdown code fences if present
function safeParseJSON(text: string): any {
  // 1. Try direct parse
  try { return JSON.parse(text); } catch {}
  // 2. Strip markdown fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }
  // 3. Extract first {...} block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  throw new Error("Could not parse JSON from Gemini response");
}

// Generic Gemini JSON fallback (for strategy/trend data — no content normalization)
async function callGeminiJSONGeneric(prompt: string, systemPrompt: string): Promise<any> {
  const fullPrompt = `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON only, no markdown, no explanation.\n\n${prompt}`;
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    config: {
      maxOutputTokens: 16384,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response");
  return safeParseJSON(text);
}

// Agent 1: Trend research — goes directly to OpenAI (Grok disabled, no credits)
async function callGrokJSON(prompt: string, systemPrompt: string): Promise<any> {
  return callOpenAIJSON(prompt, systemPrompt);
}

// Agent 2 & 4: OpenAI GPT-4o — strategy reasoning + prompt engineering (fallback: Gemini)
async function callOpenAIJSON(prompt: string, systemPrompt: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });
    return JSON.parse(response.choices[0]?.message?.content ?? "{}");
  } catch (err: any) {
    console.warn("OpenAI unavailable, falling back to Gemini:", err?.message);
    return callGeminiJSONGeneric(prompt, systemPrompt);
  }
}

// Agent 3: Gemini — creative German content writing
const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: { apiVersion: "v1" },
});

// Normalize content JSON — handle Gemini returning array, wrong field names, nested structures
function normalizeContentJSON(raw: any): any {
  if (!raw || typeof raw !== "object") return {};
  // If Gemini returns an array, take first element
  let data = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  // If nested (e.g., { CONTENT_IDEA_1: { ... } }), unwrap first value
  const keys = Object.keys(data);
  if (keys.length === 1 && typeof data[keys[0]] === "object" && !Array.isArray(data[keys[0]])) {
    const inner = data[keys[0]];
    // Only unwrap if inner looks like content (has at least one of the expected fields)
    const hasContentFields = ["hook", "hooks", "mainCaption", "caption", "CAPTION", "HOOK", "HOOKS"].some(f => f in inner);
    if (hasContentFields) data = inner;
  }
  // Normalize field names (uppercase or alternative naming)
  return {
    hooks: normalizeHooks(data.hooks ?? data.HOOKS ?? data.hook ?? data.HOOK),
    hook: normalizeHook(data.hook ?? data.HOOK ?? data.hooks ?? data.HOOKS),
    mainCaption: data.mainCaption ?? data.CAPTION ?? data.caption ?? data.mainContent ?? data.MAIN_CAPTION ?? "",
    shortCaption: data.shortCaption ?? data.SHORT_CAPTION ?? data.shortContent ?? "",
    cta: data.cta ?? data.CTA ?? data.callToAction ?? data.CALL_TO_ACTION ?? "",
    hashtags: normalizeHashtags(data.hashtags ?? data.HASHTAGS ?? data.tags ?? data.TAGS),
    imagePrompt: data.imagePrompt ?? data.IMAGE_PROMPT ?? data.imageprompt ?? "",
    videoPrompt: data.videoPrompt ?? data.VIDEO_PROMPT ?? "",
  };
}

function normalizeHooks(val: any): string[] {
  if (Array.isArray(val)) return val.filter(v => typeof v === "string");
  if (typeof val === "string" && val.length > 0) return [val];
  return [];
}

function normalizeHook(val: any): string {
  if (typeof val === "string" && val.length > 0) return val;
  if (Array.isArray(val) && val.length > 0) return val[0];
  return "";
}

function normalizeHashtags(val: any): string[] {
  if (Array.isArray(val)) return val.filter(v => typeof v === "string");
  if (typeof val === "string") return val.split(/\s+/).filter(v => v.startsWith("#"));
  return [];
}

// Agent 5: Claude Sonnet — German content refinement & quality polish
async function callClaudeRefine(contentData: any, platform: string, claudeSystemPrompt: string): Promise<any> {
  try {
    const hooks = Array.isArray(contentData.hooks) ? contentData.hooks.join(" | ") : "";
    const refinePrompt = `Du bist ein professioneller Redakteur für deutschsprachigen Social-Media-Content in Deutschland.

Überprüfe und verfeinere den folgenden ${platform}-Content auf Deutsch. Mache die Sprache lebendiger, authentischer und natürlicher — ohne den Kerninhalt oder die Marketingstrategie zu ändern. Entferne jede steife oder maschinelle Formulierung.

ORIGINAL CONTENT:
Hooks: ${hooks}
Caption: ${contentData.mainCaption ?? ""}
Short Caption: ${contentData.shortCaption ?? ""}
CTA: ${contentData.cta ?? ""}

Gib JSON zurück (kein Markdown):
{
  "hooks": ["verfeinert Hook 1", "verfeinert Hook 2", "verfeinert Hook 3"],
  "mainCaption": "verfeinerte Caption",
  "shortCaption": "verfeinerte Short Caption",
  "cta": "verfeinerte CTA"
}

Anforderungen:
- Authentisches, natürliches Deutsch — wie ein echter Mensch schreibt
- Emotionaler und überzeugender als das Original
- KEINE sichtbaren Labels oder Struktur-Annotationen im Text
- Bewahre alle wichtigen Informationen (Angebote, Adressen, Öffnungszeiten)`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: claudeSystemPrompt,
      messages: [{ role: "user", content: refinePrompt }],
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text : "";
    const parsed = JSON.parse(text.trim());

    return {
      ...contentData,
      hooks: Array.isArray(parsed.hooks) && parsed.hooks.length > 0 ? parsed.hooks : contentData.hooks,
      mainCaption: parsed.mainCaption || contentData.mainCaption,
      shortCaption: parsed.shortCaption || contentData.shortCaption,
      cta: parsed.cta || contentData.cta,
    };
  } catch (err: any) {
    console.warn("Claude refinement failed, using Gemini output as-is:", err?.message);
    return contentData;
  }
}

async function callGeminiJSON(prompt: string, systemPrompt?: string): Promise<any> {
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON only, no markdown, no explanation.\n\n${prompt}`
    : `IMPORTANT: Respond with valid JSON only, no markdown, no explanation.\n\n${prompt}`;
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    config: {
      maxOutputTokens: 16384,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response");
  const parsed = safeParseJSON(text);
  const normalized = normalizeContentJSON(parsed);
  return normalized;
}

router.get("/marketing-models", (_req, res) => {
  res.json(MARKETING_MODELS);
});

router.get("/runs", async (req, res) => {
  try {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : null;
    const runs = brandId
      ? await db.select().from(pipelineRunsTable).where(eq(pipelineRunsTable.brandId, brandId)).orderBy(pipelineRunsTable.createdAt)
      : await db.select().from(pipelineRunsTable).orderBy(pipelineRunsTable.createdAt);

    const brands = await db.select().from(brandsTable);
    const brandMap = Object.fromEntries(brands.map(b => [b.id, b.brandName]));

    res.json(runs.map(r => ({ ...r, brandName: brandMap[r.brandId] ?? null })));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pipeline runs" });
  }
});

router.get("/runs/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [run] = await db.select().from(pipelineRunsTable).where(eq(pipelineRunsTable.id, id));
    if (!run) return res.status(404).json({ error: "Pipeline run not found" });
    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, run.brandId));
    res.json({ ...run, brandName: brand?.brandName ?? null });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pipeline run" });
  }
});

router.delete("/runs/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(pipelineRunsTable).where(eq(pipelineRunsTable.id, id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete pipeline run" });
  }
});

router.post("/run", async (req, res) => {
  const { brandId, topic, goal, platform, contentCount = 1, storeSituation, contentFormat } = req.body;

  if (!brandId || !topic || !goal || !platform) {
    return res.status(400).json({ error: "Thiếu thông tin bắt buộc: brandId, topic, goal, platform" });
  }

  // platform có thể là string đơn hoặc comma-separated (Facebook,Instagram,TikTok)
  const platforms: string[] = typeof platform === "string"
    ? platform.split(",").map((p: string) => p.trim()).filter(Boolean)
    : [platform];
  const platformLabel = platforms.join(", ");

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  if (!brand) return res.status(400).json({ error: "Thương hiệu không tồn tại" });

  const [run] = await db.insert(pipelineRunsTable).values({
    brandId,
    topic,
    goal,
    platform: platformLabel,
    contentCount,
    storeSituation: storeSituation || null,
    status: "running",
    savedPlanIds: [],
  }).returning();

  const runId = run.id;
  const now = new Date();
  const month = now.toLocaleString("de-DE", { month: "long" });
  const modelList = MARKETING_MODELS.map(m => `- ${m.name} (${m.fullName}): ${m.whenToUse}`).join("\n");

  try {
    // ─── LOAD AGENT CONFIGS (từ profile của brand hoặc default) ─────────────────
    let profileId: number | null = brand.aiProfileId ?? null;
    if (!profileId) {
      const [defaultProfile] = await db
        .select()
        .from(aiProfilesTable)
        .where(eq(aiProfilesTable.isDefault, true));
      profileId = defaultProfile?.id ?? null;
    }
    const agentConfigs = profileId
      ? await db.select().from(aiAgentConfigsTable).where(eq(aiAgentConfigsTable.profileId, profileId))
      : await db.select().from(aiAgentConfigsTable);
    const grokConfig = agentConfigs.find(a => a.agentKey === "grok");
    const openaiConfig = agentConfigs.find(a => a.agentKey === "openai");
    const geminiConfig = agentConfigs.find(a => a.agentKey === "gemini");
    const claudeConfig = agentConfigs.find(a => a.agentKey === "claude");

    const grokSystem = buildSystemPrompt(grokConfig, "Du bist ein Experte für Echtzeit-Markttrends mit 10 Jahren Erfahrung im deutschen Markt.");
    const openaiSystem = buildSystemPrompt(openaiConfig, "Du bist ein führender Marketing-Stratege und Prompt-Engineering-Experte.");
    const geminiSystem = buildSystemPrompt(geminiConfig, "Du bist ein Top-Copywriter, Experte für viralen deutschen Content auf Social Media. Schreibe immer auf Deutsch, natürlich und überzeugend.");
    const claudeSystem = buildSystemPrompt(claudeConfig, "Du bist ein erfahrener Redakteur für deutschen Social-Media-Content. Du verfeinerst Texte zu natürlichem, emotionalem und überzeugendem Deutsch.");

    // Brand contact info block
    const contactBlock = [
      brand.address ? `- Địa chỉ: ${brand.address}` : null,
      brand.phone ? `- Số điện thoại: ${brand.phone}` : null,
      brand.businessHours ? `- Giờ mở cửa: ${brand.businessHours}` : null,
    ].filter(Boolean).join("\n");
    const contactSection = contactBlock ? `\nTHÔNG TIN LIÊN HỆ:\n${contactBlock}` : "";

    // ─── AGENT 1: TREND RESEARCH ───────────────────────────────────────────────
    const situationBlock = storeSituation
      ? `\nTÌNH TRẠNG HIỆN TẠI CỦA CỬA HÀNG:\n${storeSituation}\n`
      : "";

    const trendPrompt = `Du bist ein Markttrend-Experte mit 10 Jahren Erfahrung im deutschsprachigen Markt.

ANALYSE-INFORMATIONEN:
- Branche: ${brand.industry}
- Standort: ${brand.branchLocation}
- Thema: ${topic}
- Aktueller Monat: ${month}
- Plattform: ${platformLabel}${situationBlock}

Analysiere die Trends und gib JSON zurück (kein Markdown):
{
  "keywords": ["trending Keyword 1", "Keyword 2", "Keyword 3", "..."],
  "trendScore": 75,
  "recommendedAngles": ["Ansatz 1", "Ansatz 2", "Ansatz 3"],
  "seasonalContext": "saisonaler Kontext / Ereignisse diesen Monat",
  "hotTopics": ["heißes Thema 1", "Thema 2", "Thema 3", "Thema 4", "Thema 5"]
}

Anforderungen:
- keywords: 8-12 populäre Hashtags/Keywords auf ${platform} für ${brand.industry} in ${brand.branchLocation}
- trendScore: 0-100 (wie trending ist das Thema aktuell)
- recommendedAngles: 3 effektivste Content-Ansätze für den deutschen Markt
- seasonalContext: aktuelle Saison, Feiertage oder Events die das Marketing beeinflussen
- hotTopics: 5 heiße Themen in der Branche auf Deutsch`;

    const trendData = await callGrokJSON(trendPrompt, grokSystem);
    await db.update(pipelineRunsTable).set({ trendData }).where(eq(pipelineRunsTable.id, runId));

    // ─── AGENT 2: STRATEGY PLANNER ─────────────────────────────────────────────
    const strategyPrompt = `Du bist ein Marketing-Stratege mit MBA und 15 Jahren Praxiserfahrung im deutschen Markt.

MARKEN-INFORMATIONEN:
- Name: ${brand.brandName}
- Branche: ${brand.industry}
- Standort: ${brand.branchLocation}
- Zielgruppe: ${brand.targetAudience}
- Markenstimme: ${brand.brandVoice}${contactSection}${situationBlock}
STRATEGIE-ANFORDERUNGEN:
- Thema: ${topic}
- Ziel: ${goal}
- Plattform: ${platform}

ANALYSIERTE TRENDS:
- Trending Keywords: ${trendData.keywords?.join(", ")}
- Empfohlene Ansätze: ${trendData.recommendedAngles?.join(", ")}
- Saisonaler Kontext: ${trendData.seasonalContext}

MARKETING-MODELLE (EINES AUSWÄHLEN):
${modelList}

Gib JSON zurück (kein Markdown):
{
  "marketingModel": "Modellname (z.B. AIDA)",
  "modelExplanation": "Wie funktioniert dieses Modell (2-3 kurze Sätze auf Deutsch)",
  "reasoning": "Warum passt dieses Modell am besten zu diesem Fall (2-3 Sätze auf Deutsch)",
  "campaignAngle": "Konkreter Kampagnenwinkel aus Trend + Modell kombiniert",
  "funnelStage": "Awareness / Consideration / Conversion / Retention",
  "targetEmotion": "Hauptemotion die beim Kunden ausgelöst werden soll",
  "ctaStrategy": "Detaillierte Call-to-Action-Strategie auf Deutsch",
  "contentPillars": ["Content-Säule 1", "Säule 2", "Säule 3", "Säule 4"]
}`;

    const strategyData = await callOpenAIJSON(strategyPrompt, openaiSystem);
    await db.update(pipelineRunsTable).set({ strategyData }).where(eq(pipelineRunsTable.id, runId));

    // ─── AGENT 3 & 4: PER-PLATFORM CONTENT + PROMPT ────────────────────────────
    const savedPlanIds: number[] = [];
    const count = Math.max(1, Math.min(contentCount, 5));
    let lastContentData: any = null;
    let lastPromptData: any = null;

    for (const plat of platforms) {
      // Agent 3: Gemini — schreibt Content für jede Plattform auf Deutsch
      const contentPrompt = `Du bist ein Top-Copywriter für viralen ${plat}-Content im deutschsprachigen Raum.

MARKE:
- Name: ${brand.brandName}
- Branche: ${brand.industry}
- Markenstimme: ${brand.brandVoice}
- Zielgruppe: ${brand.targetAudience}
- Standort: ${brand.branchLocation}${contactSection}${situationBlock}

GEWÄHLTE STRATEGIE:
- Modell: ${strategyData.marketingModel} (${strategyData.modelExplanation})
- Kampagnenwinkel: ${strategyData.campaignAngle}
- Zielemotion: ${strategyData.targetEmotion}
- Funnel-Phase: ${strategyData.funnelStage}

TRENDS:
- Keywords: ${trendData.keywords?.join(", ")}
- Saisonaler Kontext: ${trendData.seasonalContext}

ANFORDERUNGEN:
- Thema: ${topic}
- Ziel: ${goal}
- Plattform: ${plat}${contentFormat ? `\n- Loại nội dung: ${contentFormat}` : ""}

Schreibe Content GENAU NACH DEM ${strategyData.marketingModel}-MODELL und gib JSON zurück (kein Markdown):
{
  "hooks": ["starker Hook 1", "starker Hook 2", "starker Hook 3"],
  "mainCaption": "vollständige Caption nach dem ${strategyData.marketingModel}-Modell${contentFormat ? ` angepasst an das Format ${contentFormat}` : " 150-300 Wörter"}",
  "shortCaption": "kurze Caption für Story/Reel",
  "cta": "konkreter und überzeugender Call-to-Action",
  "hashtags": ["#hashtag1", "#hashtag2", "..."]
}

Anforderungen:
- hooks: 3 Eröffnungssätze im ${plat}-Stil, die in den ersten 3 Sekunden Aufmerksamkeit erregen
- hashtags: 15-25 Hashtags (Mix aus Trending + Lokal ${brand.branchLocation} + Conversion), deutsche und englische Hashtags
- mainCaption: MUSS der Logik des ${strategyData.marketingModel}-Modells folgen, ABER KEINE sichtbaren Labels — kein "Hook:", "Value:", "CTA:", "Attention:", "Problem:", "Story:", "Step 1:" oder jegliche Struktur-Annotationen im Text. Der Text fließt natürlich ohne sichtbare Framework-Labels.${contentFormat ? `\n- Passe die Länge und Stil des Inhalts an "${contentFormat}" an` : ""}
- GESAMTER CONTENT AUF DEUTSCH — natürlich, nicht steif, authentisch`;

      const rawContentData = await callGeminiJSON(contentPrompt, geminiSystem);

      // ─── AGENT 5: CLAUDE — tinh chỉnh tiếng Đức tự nhiên ─────────────────────
      const claudeActive = claudeConfig?.isActive !== false;
      const contentData = claudeActive
        ? await callClaudeRefine(rawContentData, plat, claudeSystem)
        : rawContentData;
      lastContentData = contentData;

      // Agent 4: OpenAI — tạo prompt ảnh/video cho từng nền tảng
      const promptPrompt = `You are an expert AI prompt engineer specializing in marketing visuals for the German market.

POST INFORMATION:
- Brand: ${brand.brandName} | Industry: ${brand.industry}
- Platform: ${plat}
- Topic: ${topic}
- Main Caption (excerpt): ${contentData.mainCaption?.substring(0, 200)}...
- Brand voice: ${brand.brandVoice}
- Campaign angle: ${strategyData.campaignAngle}
- Target emotion: ${strategyData.targetEmotion}

Create professional prompts and return JSON (no markdown):
{
  "imagePrompt": "...",
  "videoPrompt": "Detailed English prompt for HailuoAI/Sora video generation with scene-by-scene description",
  "visualStyle": "Visual style description for this brand (in German)",
  "cameraDirection": "Camera angles and movements for video (English)",
  "overlayText": "German text overlay suggestions for the visual",
  "colorPalette": "Recommended color palette and mood (English)"
}

Requirements:
- imagePrompt: MUST follow the detailed cinematic structure below — extremely detailed prompt in English
- videoPrompt: describe each scene, camera movements, effects, suggested audio — in English
- Fits ${plat} format (aspect ratio, duration)
- Reflects brand tone and target emotion accurately
- overlayText suggestions should be short punchy German phrases

IMAGE PROMPT STRUCTURE — FOLLOW EXACTLY:
${buildImagePromptGuidance(brand, topic)}`;

      const promptData = await callOpenAIJSON(promptPrompt, openaiSystem);
      lastPromptData = promptData;

      const hashtags = Array.isArray(contentData.hashtags) ? contentData.hashtags.join(" ") : "";

      for (let i = 0; i < count; i++) {
        const publishDate = new Date();
        publishDate.setDate(publishDate.getDate() + i * 2 + platforms.indexOf(plat));

        const [plan] = await db.insert(contentPlansTable).values({
          brandId,
          publishDate,
          platform: plat,
          contentType: "post",
          topic,
          hook: Array.isArray(contentData.hooks) ? contentData.hooks[i % contentData.hooks.length] : "",
          caption: contentData.mainCaption ?? null,
          shortCaption: contentData.shortCaption ?? null,
          cta: contentData.cta ?? null,
          hashtags: hashtags || null,
          imagePrompt: promptData.imagePrompt ?? null,
          videoPrompt: promptData.videoPrompt ?? null,
          status: "draft",
        }).returning();

        savedPlanIds.push(plan.id);
      }
    }

    const contentData = lastContentData ?? {};
    const promptData = lastPromptData ?? {};

    const [updated] = await db.update(pipelineRunsTable)
      .set({ status: "completed", savedPlanIds, contentData, promptData, updatedAt: new Date() })
      .where(eq(pipelineRunsTable.id, runId))
      .returning();

    const [finalBrand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    res.json({ ...updated, brandName: finalBrand?.brandName ?? null });

  } catch (error: any) {
    console.error("Pipeline error:", error);
    await db.update(pipelineRunsTable)
      .set({ status: "failed", errorMessage: error?.message ?? "Unknown error", updatedAt: new Date() })
      .where(eq(pipelineRunsTable.id, runId));
    res.status(500).json({ error: "Pipeline thất bại: " + (error?.message ?? "Unknown error") });
  }
});

export default router;
