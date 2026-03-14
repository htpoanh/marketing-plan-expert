import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reviewsTable, brandsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { sql } from "drizzle-orm";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
});

const router: IRouter = Router();

// ─── STATS ────────────────────────────────────────────────────────────────────
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

// ─── REPLY TEMPLATES ──────────────────────────────────────────────────────────
router.get("/templates", async (req, res) => {
  try {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : null;
    if (!brandId) return res.status(400).json({ error: "brandId required" });

    const rows = await db.execute(
      sql`SELECT * FROM review_reply_templates WHERE brand_id = ${brandId} ORDER BY rating ASC`
    );
    res.json(rows.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.put("/templates", async (req, res) => {
  try {
    const { brandId, rating, templateText } = req.body;
    if (!brandId || !rating) return res.status(400).json({ error: "brandId and rating required" });

    await db.execute(
      sql`INSERT INTO review_reply_templates (brand_id, rating, template_text, updated_at)
          VALUES (${brandId}, ${rating}, ${templateText ?? ""}, NOW())
          ON CONFLICT (brand_id, rating) DO UPDATE
          SET template_text = EXCLUDED.template_text, updated_at = NOW()`
    );

    const rows = await db.execute(
      sql`SELECT * FROM review_reply_templates WHERE brand_id = ${brandId} AND rating = ${rating} LIMIT 1`
    );
    res.json(rows.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save template" });
  }
});

router.post("/templates/generate", async (req, res) => {
  try {
    const { brandId, rating } = req.body;
    if (!brandId || !rating) return res.status(400).json({ error: "brandId and rating required" });

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, parseInt(brandId)));
    if (!brand) return res.status(404).json({ error: "Brand not found" });

    const starLabel = ["", "1 sao — rất tệ", "2 sao — không hài lòng", "3 sao — bình thường", "4 sao — hài lòng", "5 sao — xuất sắc"][rating];
    const tone = rating >= 4 ? "vui mừng, trân trọng, mời quay lại" : rating === 3 ? "cảm ơn chân thành, ghi nhận, cam kết cải thiện" : "xin lỗi thành khẩn, cam kết khắc phục, mời liên hệ trực tiếp";

    const prompt = `Bạn là chuyên gia viết phản hồi đánh giá Google Maps cho thương hiệu "${brand.brandName}" (ngành: ${brand.industry}).

Viết MẪU phản hồi cho đánh giá ${starLabel}.
Giọng điệu thương hiệu: ${brand.brandVoice}
Hướng: ${tone}

Yêu cầu:
- 2-4 câu, tự nhiên, không sáo rỗng
- Dùng dấu [Tên khách] ở chỗ cần điền tên khách hàng (hệ thống sẽ tự điền)
- Thể hiện đúng cảm xúc và hành động phù hợp với số sao
- Tiếng Việt tự nhiên, thân thiện
- Chỉ trả về nội dung mẫu, không giải thích thêm`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 300 },
    });

    const template = response.text?.trim() ?? "";

    // Auto-save
    await db.execute(
      sql`INSERT INTO review_reply_templates (brand_id, rating, template_text, updated_at)
          VALUES (${brandId}, ${rating}, ${template}, NOW())
          ON CONFLICT (brand_id, rating) DO UPDATE
          SET template_text = EXCLUDED.template_text, updated_at = NOW()`
    );

    res.json({ template });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.post("/templates/generate-all", async (req, res) => {
  try {
    const { brandId } = req.body;
    if (!brandId) return res.status(400).json({ error: "brandId required" });

    const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, parseInt(brandId)));
    if (!brand) return res.status(404).json({ error: "Brand not found" });

    const results: Record<number, string> = {};

    for (const rating of [1, 2, 3, 4, 5]) {
      const starLabel = ["", "1 sao — rất tệ", "2 sao — không hài lòng", "3 sao — bình thường", "4 sao — hài lòng", "5 sao — xuất sắc"][rating];
      const tone = rating >= 4 ? "vui mừng, trân trọng, mời quay lại" : rating === 3 ? "cảm ơn, ghi nhận, cam kết cải thiện" : "xin lỗi thành khẩn, cam kết khắc phục";

      const prompt = `Viết MẪU phản hồi đánh giá Google Maps ${starLabel} cho "${brand.brandName}" (${brand.industry}).
Giọng điệu: ${brand.brandVoice}. Hướng: ${tone}.
Dùng [Tên khách] cho tên khách. 2-4 câu tự nhiên. Chỉ trả về nội dung mẫu.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 200 },
      });

      const template = response.text?.trim() ?? "";
      results[rating] = template;

      await db.execute(
        sql`INSERT INTO review_reply_templates (brand_id, rating, template_text, updated_at)
            VALUES (${brandId}, ${rating}, ${template}, NOW())
            ON CONFLICT (brand_id, rating) DO UPDATE
            SET template_text = EXCLUDED.template_text, updated_at = NOW()`
      );
    }

    res.json({ success: true, templates: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate all templates" });
  }
});

// ─── CHECK GOOGLE API KEY ─────────────────────────────────────────────────────
router.get("/check-api-key", async (req, res) => {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return res.json({ ok: false, reason: "GOOGLE_API_KEY chưa được cài đặt trong Secrets." });

  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=test&inputtype=textquery&fields=name&key=${key}`
    );
    const d = await r.json() as any;
    if (d.status === "OK" || d.status === "ZERO_RESULTS") {
      return res.json({ ok: true, message: "API key hợp lệ và Places API đã được bật." });
    } else if (d.status === "REQUEST_DENIED") {
      return res.json({
        ok: false,
        reason: "API key không hợp lệ hoặc chưa bật Places API.",
        status: d.status,
        rawMessage: d.error_message,
      });
    } else {
      return res.json({ ok: false, reason: `Google trả về: ${d.status}`, status: d.status });
    }
  } catch (e: any) {
    return res.json({ ok: false, reason: `Không kết nối được Google API: ${e.message}` });
  }
});

// ─── GOOGLE PLACES SYNC ───────────────────────────────────────────────────────
router.post("/sync", async (req, res) => {
  try {
    const { brandId, placeId } = req.body;
    if (!brandId || !placeId) return res.status(400).json({ error: "brandId and placeId required" });

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) return res.status(500).json({ error: "GOOGLE_API_KEY not configured" });

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,rating,reviews&language=vi&reviews_sort=newest&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json() as any;

    if (data.status !== "OK") {
      let hint = "";
      if (data.status === "REQUEST_DENIED") {
        hint = " → Vui lòng kiểm tra GOOGLE_API_KEY: key cần bật 'Places API' tại Google Cloud Console (console.cloud.google.com) và không bị giới hạn server IP.";
      } else if (data.status === "INVALID_REQUEST") {
        hint = " → Place ID không đúng định dạng. Vui lòng kiểm tra lại Google Place ID của cửa hàng.";
      } else if (data.status === "NOT_FOUND") {
        hint = " → Không tìm thấy địa điểm với Place ID này. Vui lòng kiểm tra lại.";
      }
      return res.status(400).json({
        error: `Google API lỗi: ${data.status}.${hint}`,
        status: data.status,
        rawMessage: data.error_message,
      });
    }

    const gReviews = data.result?.reviews ?? [];
    let imported = 0;
    let skipped = 0;

    for (const gr of gReviews) {
      const googleReviewId = gr.time?.toString() ?? `${gr.author_name}_${gr.rating}`;
      const existing = await db.execute(
        sql`SELECT id FROM reviews WHERE brand_id = ${brandId} AND google_review_id = ${googleReviewId} LIMIT 1`
      );
      if (existing.rows.length > 0) { skipped++; continue; }

      await db.insert(reviewsTable).values({
        brandId: parseInt(brandId),
        reviewerName: gr.author_name ?? "Ẩn danh",
        rating: gr.rating ?? 5,
        reviewText: gr.text ?? null,
        reviewDate: gr.time ? new Date(gr.time * 1000) : new Date(),
        replied: false,
        googleReviewId,
      });
      imported++;
    }

    // Save placeId to brand if not set
    await db.execute(
      sql`UPDATE brands SET google_place_id = ${placeId} WHERE id = ${brandId} AND (google_place_id IS NULL OR google_place_id = '')`
    );

    res.json({
      success: true,
      imported,
      skipped,
      total: gReviews.length,
      placeName: data.result?.name,
      placeRating: data.result?.rating,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to sync Google reviews" });
  }
});

// ─── REVIEWS CRUD ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { brandId, rating, replied } = req.query;
    const conditions = [];
    if (brandId) conditions.push(eq(reviewsTable.brandId, parseInt(brandId as string)));
    if (rating) conditions.push(eq(reviewsTable.rating, parseInt(rating as string)));
    if (replied !== undefined && replied !== "") conditions.push(eq(reviewsTable.replied, replied === "true"));

    const reviews = conditions.length > 0
      ? await db.select().from(reviewsTable).where(and(...conditions)).orderBy(desc(reviewsTable.reviewDate))
      : await db.select().from(reviewsTable).orderBy(desc(reviewsTable.reviewDate));

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

    // Check if template exists for this rating
    const tmpl = await db.execute(
      sql`SELECT template_text FROM review_reply_templates WHERE brand_id = ${review.brandId} AND rating = ${review.rating} LIMIT 1`
    );
    const template = tmpl.rows[0]?.template_text as string | undefined;

    if (template && template.trim()) {
      const reply = template.replace(/\[Tên khách\]/gi, review.reviewerName);
      return res.json({ reply, fromTemplate: true });
    }

    // Fallback: generate fresh with AI
    const starLabel = ["", "rất tệ", "không tốt", "bình thường", "tốt", "tuyệt vời"][review.rating];
    const prompt = `Bạn là nhân viên CSKH của "${brand?.brandName || "cửa hàng"}".
Khách ${review.reviewerName} đánh giá ${review.rating} sao (${starLabel}).
Nội dung: "${review.reviewText || "(Không có nội dung)"}"
Viết phản hồi 2-4 câu, lịch sự, tự nhiên, phù hợp số sao. Chỉ trả nội dung phản hồi.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 300 },
    });

    const reply = response.text?.trim() ?? "Cảm ơn bạn đã đánh giá! Chúng tôi rất trân trọng phản hồi của bạn.";
    res.json({ reply, fromTemplate: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate reply" });
  }
});

router.post("/:id/reply", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { replyText } = req.body;
    const [review] = await db.update(reviewsTable)
      .set({ replied: true, replyText, replyDate: new Date() })
      .where(eq(reviewsTable.id, id))
      .returning();
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: "Failed to save reply" });
  }
});

export default router;
