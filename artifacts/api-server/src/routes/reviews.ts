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

// ─── PLACES API (NEW) v1 HELPER ───────────────────────────────────────────────
function placesApiErrorToVietnamese(status: string, message: string): { userMessage: string; hint: string } {
  const msg = (message ?? "").toLowerCase();

  // API key problems — check raw message first regardless of status
  if (msg.includes("api key not valid") || msg.includes("invalid api key") || msg.includes("api_key_invalid")) {
    return {
      userMessage: "API key không hợp lệ. Vui lòng kiểm tra lại GOOGLE_API_KEY trong Replit Secrets.",
      hint: "REQUEST_DENIED",
    };
  }

  if (status === "PERMISSION_DENIED") {
    if (msg.includes("billing") || msg.includes("payment")) {
      return {
        userMessage: "Chưa bật thanh toán (Billing) trong Google Cloud.",
        hint: "BILLING_NOT_ENABLED",
      };
    }
    if (msg.includes("places api") || msg.includes("service is not enabled") || msg.includes("not enabled")) {
      return {
        userMessage: "Chưa bật Places API (New) trong Google Cloud Console.",
        hint: "REQUEST_DENIED",
      };
    }
    return {
      userMessage: "API key bị từ chối quyền truy cập. Kiểm tra lại API key và quyền Places API (New).",
      hint: "PERMISSION_DENIED",
    };
  }
  if (status === "NOT_FOUND") {
    return {
      userMessage: "Không tìm thấy địa điểm với Place ID này. Vui lòng kiểm tra lại.",
      hint: "NOT_FOUND",
    };
  }
  if (status === "INVALID_ARGUMENT") {
    return {
      userMessage: "Place ID không đúng định dạng. Vui lòng kiểm tra lại.",
      hint: "INVALID_ARGUMENT",
    };
  }
  if (status === "UNAUTHENTICATED") {
    return {
      userMessage: "API key không hợp lệ hoặc chưa bật Places API (New).",
      hint: "REQUEST_DENIED",
    };
  }
  return {
    userMessage: `Google API lỗi: ${status}. ${message ?? ""}`.trim(),
    hint: status,
  };
}

// ─── CHECK GOOGLE API KEY ─────────────────────────────────────────────────────
router.get("/check-api-key", async (req, res) => {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return res.json({ ok: false, reason: "GOOGLE_API_KEY chưa được cài đặt trong Secrets.", hint: "NO_KEY" });

  try {
    // Test with the new Places API (New) v1 — fetch a known public place with reviews field
    // Use Google's Zurich office as a well-known test place
    const testPlaceId = "ChIJGaK-SZcLkEcRA9wf5_GNbuY";
    const r = await fetch(
      `https://places.googleapis.com/v1/places/${testPlaceId}?languageCode=vi`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "displayName,rating,reviews",
        },
      }
    );
    const d = await r.json() as any;

    if (r.ok) {
      return res.json({ ok: true, message: "API key hợp lệ — Places API (New) hoạt động và có thể tải reviews!" });
    }

    const errStatus = d.error?.status ?? "UNKNOWN";
    const errMsg = d.error?.message ?? "";
    const { userMessage, hint } = placesApiErrorToVietnamese(errStatus, errMsg);

    return res.json({ ok: false, reason: userMessage, status: errStatus, hint });
  } catch (e: any) {
    return res.json({ ok: false, reason: `Không kết nối được Google API: ${e.message}`, hint: "NETWORK_ERROR" });
  }
});

// ─── GOOGLE PLACES SYNC (New Places API v1) ───────────────────────────────────
router.post("/sync", async (req, res) => {
  try {
    const { brandId, placeId } = req.body;
    if (!brandId || !placeId) return res.status(400).json({ error: "brandId and placeId required" });

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) return res.status(500).json({ error: "GOOGLE_API_KEY not configured" });

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=vi`,
      {
        headers: {
          "X-Goog-Api-Key": GOOGLE_API_KEY,
          "X-Goog-FieldMask": "displayName,rating,reviews",
        },
      }
    );
    const data = await response.json() as any;

    if (!response.ok) {
      const errStatus = data.error?.status ?? "UNKNOWN";
      const errMsg = data.error?.message ?? "";
      const { userMessage, hint } = placesApiErrorToVietnamese(errStatus, errMsg);
      console.error(`[reviews/sync] Google Places API error: ${errStatus} — ${errMsg}`);
      return res.status(400).json({
        error: userMessage,
        status: errStatus,
        hint,
        rawMessage: errMsg,
      });
    }

    // New API response format: reviews[].authorAttribution.displayName, .rating, .text.text, .publishTime, .name
    const gReviews: any[] = data.reviews ?? [];
    let imported = 0;
    let skipped = 0;

    for (const gr of gReviews) {
      // Use the review's resource name as unique ID (e.g. "places/.../reviews/AbcDef123")
      const googleReviewId = gr.name ?? `${gr.authorAttribution?.displayName}_${gr.rating}_${gr.publishTime}`;
      const existing = await db.execute(
        sql`SELECT id FROM reviews WHERE brand_id = ${brandId} AND google_review_id = ${googleReviewId} LIMIT 1`
      );
      if (existing.rows.length > 0) { skipped++; continue; }

      const publishTime = gr.publishTime ? new Date(gr.publishTime) : new Date();

      await db.insert(reviewsTable).values({
        brandId: parseInt(brandId),
        reviewerName: gr.authorAttribution?.displayName ?? "Ẩn danh",
        rating: gr.rating ?? 5,
        reviewText: gr.text?.text ?? gr.originalText?.text ?? null,
        reviewDate: publishTime,
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
      placeName: data.displayName?.text ?? null,
      placeRating: data.rating ?? null,
    });
  } catch (error) {
    console.error("[reviews/sync] Unexpected error:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi đồng bộ Google Reviews. Vui lòng thử lại." });
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
