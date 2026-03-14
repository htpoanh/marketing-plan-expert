import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { pipelineRunsTable, contentPlansTable, brandsTable, aiAgentConfigsTable, aiProfilesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

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

// Agent 1: Grok — real-time trends & market research (fallback: OpenAI)
async function callGrokJSON(prompt: string, systemPrompt: string): Promise<any> {
  try {
    const response = await grok.chat.completions.create({
      model: "grok-3",
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });
    return JSON.parse(response.choices[0]?.message?.content ?? "{}");
  } catch (err: any) {
    console.warn("Grok unavailable, falling back to OpenAI for Trend Research:", err?.message);
    return callOpenAIJSON(prompt, systemPrompt);
  }
}

// Agent 2 & 4: OpenAI GPT-4o — strategy reasoning + prompt engineering
async function callOpenAIJSON(prompt: string, systemPrompt: string): Promise<any> {
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
}

// Agent 3: Gemini — creative Vietnamese content writing
const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
});

async function callGeminiJSON(prompt: string, systemPrompt?: string): Promise<any> {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const response = await gemini.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    config: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });
  return JSON.parse(response.text ?? "{}");
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
  const { brandId, topic, goal, platform, contentCount = 1, storeSituation } = req.body;

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
  const month = now.toLocaleString("vi-VN", { month: "long" });
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

    const grokSystem = buildSystemPrompt(grokConfig, "Bạn là chuyên gia phân tích xu hướng thị trường thời gian thực với 10 năm kinh nghiệm.");
    const openaiSystem = buildSystemPrompt(openaiConfig, "Bạn là chuyên gia chiến lược marketing và prompt engineering hàng đầu.");
    const geminiSystem = buildSystemPrompt(geminiConfig, "Bạn là copywriter hàng đầu, chuyên gia viết nội dung viral tiếng Việt tự nhiên.");

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

    const trendPrompt = `Bạn là chuyên gia phân tích xu hướng thị trường với 10 năm kinh nghiệm.

THÔNG TIN PHÂN TÍCH:
- Ngành: ${brand.industry}
- Địa điểm: ${brand.branchLocation}
- Chủ đề: ${topic}
- Tháng hiện tại: ${month}
- Nền tảng: ${platformLabel}${situationBlock}

Hãy phân tích xu hướng và trả về JSON (không markdown):
{
  "keywords": ["từ khóa trending 1", "từ khóa 2", "từ khóa 3", "..."],
  "trendScore": 75,
  "recommendedAngles": ["góc tiếp cận 1", "góc tiếp cận 2", "góc tiếp cận 3"],
  "seasonalContext": "bối cảnh mùa vụ/sự kiện đặc biệt tháng này",
  "hotTopics": ["chủ đề nóng 1", "chủ đề nóng 2", "chủ đề nóng 3", "chủ đề nóng 4", "chủ đề nóng 5"]
}

Yêu cầu:
- keywords: 8-12 từ khóa phổ biến trên ${platform} cho ngành ${brand.industry} tại ${brand.branchLocation}
- trendScore: 0-100 (mức độ trending của chủ đề)
- recommendedAngles: 3 hướng tiếp cận nội dung hiệu quả nhất hiện tại
- seasonalContext: sự kiện/mùa/ngày lễ nào đang hoặc sắp đến ảnh hưởng đến marketing
- hotTopics: 5 chủ đề đang hot trong ngành`;

    const trendData = await callGrokJSON(trendPrompt, grokSystem);
    await db.update(pipelineRunsTable).set({ trendData }).where(eq(pipelineRunsTable.id, runId));

    // ─── AGENT 2: STRATEGY PLANNER ─────────────────────────────────────────────
    const strategyPrompt = `Bạn là chuyên gia chiến lược marketing với bằng MBA và 15 năm thực chiến.

THÔNG TIN THƯƠNG HIỆU:
- Tên: ${brand.brandName}
- Ngành: ${brand.industry}
- Địa điểm: ${brand.branchLocation}
- Khách hàng mục tiêu: ${brand.targetAudience}
- Giọng điệu: ${brand.brandVoice}${contactSection}${situationBlock}
YÊU CẦU CHIẾN LƯỢC:
- Chủ đề: ${topic}
- Mục tiêu: ${goal}
- Nền tảng: ${platform}

XU HƯỚNG ĐÃ PHÂN TÍCH:
- Keywords trending: ${trendData.keywords?.join(", ")}
- Góc tiếp cận gợi ý: ${trendData.recommendedAngles?.join(", ")}
- Bối cảnh mùa: ${trendData.seasonalContext}

CÁC MÔ HÌNH MARKETING PHẢI CHỌN MỘT:
${modelList}

Trả về JSON (không markdown):
{
  "marketingModel": "tên mô hình (ví dụ: AIDA)",
  "modelExplanation": "giải thích mô hình này hoạt động như thế nào (2-3 câu ngắn gọn)",
  "reasoning": "lý do tại sao mô hình này phù hợp nhất với case này (2-3 câu)",
  "campaignAngle": "góc độ chiến dịch cụ thể kết hợp trend + mô hình",
  "funnelStage": "Awareness / Consideration / Conversion / Retention",
  "targetEmotion": "cảm xúc chính muốn kích thích ở khách hàng",
  "ctaStrategy": "chiến lược kêu gọi hành động chi tiết",
  "contentPillars": ["trụ cột nội dung 1", "trụ cột 2", "trụ cột 3", "trụ cột 4"]
}`;

    const strategyData = await callOpenAIJSON(strategyPrompt, openaiSystem);
    await db.update(pipelineRunsTable).set({ strategyData }).where(eq(pipelineRunsTable.id, runId));

    // ─── AGENT 3 & 4: PER-PLATFORM CONTENT + PROMPT ────────────────────────────
    const savedPlanIds: number[] = [];
    const count = Math.max(1, Math.min(contentCount, 5));
    let lastContentData: any = null;
    let lastPromptData: any = null;

    for (const plat of platforms) {
      // Agent 3: Gemini — viết nội dung cho từng nền tảng
      const contentPrompt = `Bạn là copywriter hàng đầu, chuyên gia viết nội dung viral cho ${plat}.

THƯƠNG HIỆU:
- Tên: ${brand.brandName}
- Ngành: ${brand.industry}
- Giọng điệu: ${brand.brandVoice}
- Khách hàng: ${brand.targetAudience}
- Địa điểm: ${brand.branchLocation}${contactSection}${situationBlock}

CHIẾN LƯỢC ĐÃ CHỌN:
- Mô hình: ${strategyData.marketingModel} (${strategyData.modelExplanation})
- Góc chiến dịch: ${strategyData.campaignAngle}
- Cảm xúc mục tiêu: ${strategyData.targetEmotion}
- Giai đoạn phễu: ${strategyData.funnelStage}

XU HƯỚNG:
- Keywords: ${trendData.keywords?.join(", ")}
- Bối cảnh: ${trendData.seasonalContext}

YÊU CẦU:
- Chủ đề: ${topic}
- Mục tiêu: ${goal}
- Nền tảng: ${plat}

Viết nội dung THEO ĐÚNG MÔ HÌNH ${strategyData.marketingModel} và trả về JSON (không markdown):
{
  "hooks": ["hook mạnh 1", "hook mạnh 2", "hook mạnh 3"],
  "mainCaption": "caption đầy đủ 150-300 từ theo mô hình ${strategyData.marketingModel}",
  "shortCaption": "caption ngắn 50-80 từ cho story/reel",
  "cta": "kêu gọi hành động cụ thể và hấp dẫn",
  "hashtags": ["#hashtag1", "#hashtag2", "..."]
}

Yêu cầu:
- hooks: 3 câu mở đầu theo phong cách ${plat}, gây chú ý ngay 3 giây đầu
- hashtags: 15-25 hashtags (mix trending + local ${brand.branchLocation} + conversion)
- mainCaption: PHẢI tuân theo cấu trúc mô hình ${strategyData.marketingModel}
- Toàn bộ nội dung tiếng Việt tự nhiên, không cứng nhắc`;

      const contentData = await callGeminiJSON(contentPrompt, geminiSystem);
      lastContentData = contentData;

      // Agent 4: OpenAI — tạo prompt ảnh/video cho từng nền tảng
      const promptPrompt = `Bạn là chuyên gia AI prompt engineering cho hình ảnh và video marketing.

THÔNG TIN BÀI ĐĂNG:
- Thương hiệu: ${brand.brandName} | Ngành: ${brand.industry}
- Nền tảng: ${plat}
- Chủ đề: ${topic}
- Caption chính: ${contentData.mainCaption?.substring(0, 200)}...
- Phong cách thương hiệu: ${brand.brandVoice}
- Góc chiến lược: ${strategyData.campaignAngle}
- Cảm xúc: ${strategyData.targetEmotion}

Tạo prompts chuyên nghiệp và trả về JSON (không markdown):
{
  "imagePrompt": "Detailed English prompt for DALL-E/Midjourney image generation",
  "videoPrompt": "Detailed English prompt for HailuoAI/Sora video generation with scene description",
  "visualStyle": "Mô tả phong cách hình ảnh tổng thể (bằng tiếng Việt)",
  "cameraDirection": "Camera angles and movements for video (English)",
  "overlayText": "Text overlay suggestions for the visual",
  "colorPalette": "Recommended color palette and mood"
}

Yêu cầu:
- imagePrompt: cực kỳ chi tiết (ánh sáng, góc, màu sắc, bố cục, phong cách, chất lượng)
- videoPrompt: mô tả từng cảnh, chuyển động camera, hiệu ứng, âm thanh gợi ý
- Phù hợp với định dạng ${plat} (tỉ lệ, độ dài)
- Phản ánh đúng tone thương hiệu và cảm xúc mục tiêu`;

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
