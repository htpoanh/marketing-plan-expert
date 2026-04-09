import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { brandsTable, strategiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
});

const router: IRouter = Router();

router.post("/generate", async (req, res) => {
  try {
    const { brandId, platform, contentType, topic, campaignGoal, additionalContext } = req.body;

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) return res.status(404).json({ error: "Brand not found" });

    const prompt = `Bạn là chuyên gia marketing số hàng đầu. Hãy tạo nội dung marketing cho:

THÔNG TIN THƯƠNG HIỆU:
- Tên: ${brand.brandName}
- Ngành: ${brand.industry}
- Địa điểm: ${brand.branchLocation}
- Khách hàng mục tiêu: ${brand.targetAudience}
- Giọng điệu thương hiệu: ${brand.brandVoice}

YÊU CẦU NỘI DUNG:
- Nền tảng: ${platform}
- Loại nội dung: ${contentType}
- Chủ đề: ${topic}
- Mục tiêu chiến dịch: ${campaignGoal}
${additionalContext ? `- Thông tin bổ sung: ${additionalContext}` : ""}

Hãy tạo nội dung JSON với cấu trúc sau (không thêm markdown code block):
{
  "hooks": ["hook1", "hook2", "hook3"],
  "mainCaption": "caption dài đầy đủ",
  "shortCaption": "caption ngắn",
  "cta": "call to action",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "..."],
  "imagePrompt": "mô tả chi tiết cho AI tạo ảnh",
  "videoPrompt": "mô tả chi tiết cho AI tạo video",
  "visualStyle": "phong cách hình ảnh"
}

Yêu cầu:
- hooks: 3 câu mở đầu viral, thu hút sự chú ý
- hashtags: mix giữa trending, local (${brand.branchLocation}), và conversion tags (15-20 hashtags)
- imagePrompt và videoPrompt: bằng tiếng Anh, chi tiết để AI có thể tạo
- Toàn bộ nội dung tiếng Việt phù hợp với ${platform}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    let result;
    try {
      result = JSON.parse(response.text ?? "{}");
    } catch {
      result = {
        hooks: ["Hook 1", "Hook 2", "Hook 3"],
        mainCaption: response.text ?? "",
        shortCaption: "",
        cta: "Liên hệ ngay!",
        hashtags: [],
        imagePrompt: "Professional product photo",
        videoPrompt: "Short engaging video",
        visualStyle: "Modern and clean",
      };
    }

    res.json(result);
  } catch (error) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: "Failed to generate content" });
  }
});

// Lightweight situation analysis: extract topic & goal suggestions from store situation text
router.post("/analyze-situation", async (req, res) => {
  try {
    const { situation, brandId } = req.body;
    if (!situation || !situation.trim()) {
      return res.status(400).json({ error: "Cần có mô tả tình trạng" });
    }

    let brandContext = "";
    if (brandId) {
      const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
      if (brand) {
        brandContext = `\nNGÀNH: ${brand.industry} — ${brand.branchLocation}`;
      }
    }

    const prompt = `Phân tích ngắn gọn tình trạng kinh doanh sau và trích xuất các gợi ý Topic và Mục tiêu marketing phù hợp.${brandContext}

TÌNH TRẠNG:
${situation}

Trả về JSON (không markdown):
{
  "suggestedTopics": ["topic ngắn gọn 1", "topic 2", "topic 3"],
  "suggestedGoals": ["mục tiêu 1", "mục tiêu 2", "mục tiêu 3"]
}

Yêu cầu:
- suggestedTopics: 3 chủ đề bài viết cụ thể, ngắn gọn (5-15 từ) phù hợp với tình trạng
- suggestedGoals: 3 mục tiêu chiến dịch rõ ràng (5-15 từ) phù hợp với tình trạng`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    });

    let result;
    try {
      result = JSON.parse(response.text ?? "{}");
    } catch {
      result = { suggestedTopics: [], suggestedGoals: [] };
    }

    res.json(result);
  } catch (error) {
    console.error("Error analyzing situation:", error);
    res.status(500).json({ error: "Failed to analyze situation" });
  }
});

router.post("/strategy", async (req, res) => {
  try {
    const { brandId, campaignGoal, platform, duration, storeSituation } = req.body;

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
    if (!brand) return res.status(404).json({ error: "Brand not found" });

    const situationBlock = storeSituation
      ? `\nTÌNH TRẠNG HIỆN TẠI CỦA CỬA HÀNG:\n${storeSituation}\n`
      : "";

    const prompt = `Bạn là chuyên gia chiến lược marketing với 15 năm kinh nghiệm. Phân tích và tạo chiến lược marketing cho:

THƯƠNG HIỆU:
- Tên: ${brand.brandName}
- Ngành: ${brand.industry}
- Địa điểm: ${brand.branchLocation}
- Khách hàng mục tiêu: ${brand.targetAudience}
- Giọng điệu: ${brand.brandVoice}
${situationBlock}
YÊU CẦU CHIẾN LƯỢC:
- Nền tảng: ${platform}
- Mục tiêu: ${campaignGoal}
${duration ? `- Thời gian: ${duration}` : ""}

Các mô hình marketing có sẵn: AIDA, STP, 4P/7P, Marketing Funnel, Content Pillars, Hook-Value-CTA, Local SEO, Viral Social Media Strategy

Trả về JSON (không markdown):
{
  "marketingModel": "tên mô hình được chọn",
  "reasoning": "lý do tại sao chọn mô hình này (2-3 câu)",
  "campaignAngle": "góc độ chiến dịch cụ thể",
  "funnelStage": "giai đoạn phễu marketing (Awareness/Consideration/Conversion/Retention)",
  "targetEmotion": "cảm xúc mục tiêu muốn kích thích ở khách hàng",
  "ctaStrategy": "chiến lược kêu gọi hành động cụ thể",
  "suggestedTopics": ["chủ đề 1", "chủ đề 2", "chủ đề 3", "chủ đề 4", "chủ đề 5"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    let result;
    try {
      result = JSON.parse(response.text ?? "{}");
    } catch {
      result = {
        marketingModel: "AIDA",
        reasoning: response.text ?? "",
        campaignAngle: "",
        funnelStage: "Awareness",
        targetEmotion: "",
        ctaStrategy: "",
        suggestedTopics: [],
      };
    }

    // Persist strategy result to DB
    let persistError: string | null = null;
    try {
      await db.insert(strategiesTable).values({
        brandId,
        platform,
        campaignGoal,
        duration: duration ?? null,
        storeSituation: storeSituation ?? null,
        marketingModel: result.marketingModel ?? null,
        reasoning: result.reasoning ?? null,
        campaignAngle: result.campaignAngle ?? null,
        funnelStage: result.funnelStage ?? null,
        targetEmotion: result.targetEmotion ?? null,
        ctaStrategy: result.ctaStrategy ?? null,
        suggestedTopics: result.suggestedTopics ?? [],
      });
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      console.warn("Failed to persist strategy to DB:", msg);
      persistError = msg;
    }

    res.json({ ...result, ...(persistError ? { _persistError: persistError } : {}) });
  } catch (error) {
    console.error("Error generating strategy:", error);
    res.status(500).json({ error: "Failed to generate strategy" });
  }
});

export default router;
