import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reviewsTable, brandsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
});

const router: IRouter = Router();

router.get("/stats", async (req, res) => {
  try {
    const brandIdFilter = req.query.brandId ? parseInt(req.query.brandId as string) : null;

    const brands = await db.select().from(brandsTable);
    const filteredBrands = brandIdFilter ? brands.filter(b => b.id === brandIdFilter) : brands;

    const stats = await Promise.all(filteredBrands.map(async (brand) => {
      const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.brandId, brand.id));
      const total = reviews.length;
      const replied = reviews.filter(r => r.replied).length;
      const avg = total > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
      return {
        brandId: brand.id,
        brandName: brand.brandName,
        totalReviews: total,
        averageRating: Math.round(avg * 10) / 10,
        repliedCount: replied,
        unrepliedCount: total - replied,
        rating1Count: reviews.filter(r => r.rating === 1).length,
        rating2Count: reviews.filter(r => r.rating === 2).length,
        rating3Count: reviews.filter(r => r.rating === 3).length,
        rating4Count: reviews.filter(r => r.rating === 4).length,
        rating5Count: reviews.filter(r => r.rating === 5).length,
      };
    }));

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch review stats" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { brandId, rating, replied } = req.query;
    let query = db.select().from(reviewsTable);

    const conditions = [];
    if (brandId) conditions.push(eq(reviewsTable.brandId, parseInt(brandId as string)));
    if (rating) conditions.push(eq(reviewsTable.rating, parseInt(rating as string)));
    if (replied !== undefined) conditions.push(eq(reviewsTable.replied, replied === "true"));

    const reviews = conditions.length > 0
      ? await db.select().from(reviewsTable).where(and(...conditions)).orderBy(reviewsTable.reviewDate)
      : await db.select().from(reviewsTable).orderBy(reviewsTable.reviewDate);

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [review] = await db.insert(reviewsTable).values({
      brandId: body.brandId,
      reviewerName: body.reviewerName,
      rating: body.rating,
      reviewText: body.reviewText ?? null,
      reviewDate: new Date(body.reviewDate),
      replied: false,
      googleReviewId: body.googleReviewId ?? null,
    }).returning();
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ error: "Failed to create review" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch review" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete review" });
  }
});

router.post("/:id/generate-reply", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    if (!review) return res.status(404).json({ error: "Review not found" });

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, review.brandId));

    const starLabel = ["", "rất tệ", "không tốt", "bình thường", "tốt", "tuyệt vời"][review.rating];
    const prompt = `Bạn là nhân viên chăm sóc khách hàng chuyên nghiệp của cửa hàng "${brand?.brandName || "cửa hàng"}".

Khách hàng ${review.reviewerName} vừa để lại đánh giá ${review.rating} sao (${starLabel}).
Nội dung đánh giá: "${review.reviewText || "(Không có nội dung)"}"

Hãy viết một phản hồi lịch sự, chuyên nghiệp bằng tiếng Việt.
- Nếu đánh giá 4-5 sao: Cảm ơn chân thành, thể hiện niềm vui, mời quay lại.
- Nếu đánh giá 3 sao: Cảm ơn, ghi nhận góp ý, cam kết cải thiện.
- Nếu đánh giá 1-2 sao: Xin lỗi thành khẩn, cam kết khắc phục, mời liên hệ trực tiếp để giải quyết.

Phản hồi nên ngắn gọn (2-4 câu), tự nhiên, không sáo rỗng. Chỉ trả về nội dung phản hồi, không thêm tiêu đề hay giải thích.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192 },
    });

    const reply = response.text ?? "Cảm ơn bạn đã đánh giá! Chúng tôi rất trân trọng phản hồi của bạn.";
    res.json({ reply });
  } catch (error) {
    console.error("Error generating reply:", error);
    res.status(500).json({ error: "Failed to generate reply" });
  }
});

router.post("/:id/reply", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { replyText } = req.body;
    const [review] = await db.update(reviewsTable)
      .set({
        replied: true,
        replyText,
        replyDate: new Date(),
      })
      .where(eq(reviewsTable.id, id))
      .returning();
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: "Failed to save reply" });
  }
});

export default router;
