import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reviewsTable, brandsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getValidTokens, ensureAccountId } from "./google-auth";

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

    const prompt = `Du bist ein professioneller Kundenservice-Experte für das Unternehmen "${brand.brandName}" (Branche: ${brand.industry}) in Deutschland.

Schreibe eine VORLAGE für eine Google Maps Bewertungsantwort auf eine ${starLabel}-Bewertung.
Markenstimme: ${brand.brandVoice}
Ton: ${tone}

Anforderungen:
- 2-4 Sätze, natürlich auf Deutsch, nicht robotisch
- Verwende [Kundenname] als Platzhalter für den Kundennamen
- Zeige die richtige Emotion passend zur Sternebewertung
- Professionell, warm und authentisch
- Gib NUR den Vorlagentext zurück, keine Erklärungen`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: "Du bist ein Experte für professionelle deutschsprachige Kundenkommunikation. Du schreibst empathische, authentische Google-Bewertungsantworten.",
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const template = block.type === "text" ? block.text.trim() : "";

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
      const starLabel = ["", "1 Stern — sehr schlecht", "2 Sterne — unzufrieden", "3 Sterne — durchschnittlich", "4 Sterne — zufrieden", "5 Sterne — ausgezeichnet"][rating];
      const tone = rating >= 4 ? "freudig dankbar, herzlich einladend" : rating === 3 ? "aufrichtig dankend, verbesserungsbereit" : "aufrichtig entschuldigend, lösungsorientiert";

      const prompt = `Schreibe eine VORLAGE für eine Google Maps Bewertungsantwort auf eine ${starLabel}-Bewertung für "${brand.brandName}" (${brand.industry}) in Deutschland.
Markenstimme: ${brand.brandVoice}. Ton: ${tone}.
Verwende [Kundenname] als Platzhalter. 2-4 Sätze auf Deutsch. Gib NUR den Vorlagentext zurück.`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: "Du bist ein Experte für professionelle deutschsprachige Kundenkommunikation. Du schreibst empathische, authentische Google-Bewertungsantworten.",
        messages: [{ role: "user", content: prompt }],
      });

      const block = message.content[0];
      const template = block.type === "text" ? block.text.trim() : "";
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

// ─── SYNC ALL BRANDS via Places API ───────────────────────────────────────────
router.post("/sync-all-places", async (req, res) => {
  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) return res.status(500).json({ error: "GOOGLE_API_KEY not configured" });

    const brands = await db.execute(
      sql`SELECT id, brand_name, google_place_id FROM brands WHERE google_place_id IS NOT NULL AND google_place_id != '' ORDER BY id`
    );

    let totalImported = 0;
    let totalSkipped = 0;
    const results: { brandId: number; brandName: string; imported: number; skipped: number; error?: string }[] = [];

    for (const brand of brands.rows as any[]) {
      try {
        const response = await fetch(
          `https://places.googleapis.com/v1/places/${encodeURIComponent(brand.google_place_id)}?languageCode=vi`,
          {
            headers: {
              "X-Goog-Api-Key": GOOGLE_API_KEY,
              "X-Goog-FieldMask": "displayName,rating,reviews",
            },
          }
        );
        const data = await response.json() as any;
        if (!response.ok) {
          results.push({ brandId: brand.id, brandName: brand.brand_name, imported: 0, skipped: 0, error: data.error?.message ?? "API error" });
          continue;
        }

        const gReviews: any[] = data.reviews ?? [];
        let imported = 0;
        let skipped = 0;
        for (const gr of gReviews) {
          const googleReviewId = gr.name ?? `${gr.authorAttribution?.displayName}_${gr.rating}_${gr.publishTime}`;
          const existing = await db.execute(
            sql`SELECT id FROM reviews WHERE brand_id = ${brand.id} AND google_review_id = ${googleReviewId} LIMIT 1`
          );
          if (existing.rows.length > 0) { skipped++; continue; }
          const publishTime = gr.publishTime ? new Date(gr.publishTime) : new Date();
          await db.insert(reviewsTable).values({
            brandId: brand.id,
            reviewerName: gr.authorAttribution?.displayName ?? "Ẩn danh",
            rating: gr.rating ?? 5,
            reviewText: gr.text?.text ?? gr.originalText?.text ?? null,
            reviewDate: publishTime,
            replied: false,
            googleReviewId,
          });
          imported++;
        }
        totalImported += imported;
        totalSkipped += skipped;
        results.push({ brandId: brand.id, brandName: brand.brand_name, imported, skipped });
      } catch (e) {
        results.push({ brandId: brand.id, brandName: brand.brand_name, imported: 0, skipped: 0, error: String(e) });
      }
    }

    console.log(`[sync-all-places] Done: ${totalImported} imported, ${totalSkipped} skipped across ${brands.rows.length} brands`);
    res.json({ success: true, totalImported, totalSkipped, brands: results });
  } catch (error) {
    console.error("[sync-all-places] Error:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi đồng bộ tất cả Reviews." });
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

    // Fallback: generate fresh with AI (in German)
    const starLabel = ["", "1 Stern — sehr schlecht", "2 Sterne — unzufrieden", "3 Sterne — durchschnittlich", "4 Sterne — zufrieden", "5 Sterne — ausgezeichnet"][review.rating];
    const tone = review.rating >= 4 ? "freudig dankend und herzlich einladend" : review.rating === 3 ? "aufrichtig dankend und verbesserungsbereit" : "aufrichtig entschuldigend und lösungsorientiert";
    const prompt = `Du bist ein professioneller Kundenservice-Mitarbeiter von "${brand?.brandName || "unserem Unternehmen"}".
Kunde ${review.reviewerName} hat ${review.rating} Sterne gegeben (${starLabel}).
Bewertung: "${review.reviewText || "(Kein Text)"}"
Ton: ${tone}
Schreibe eine natürliche, professionelle Google-Bewertungsantwort auf Deutsch (2–4 Sätze). Nur den Antworttext zurückgeben.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: "Du bist ein Experte für professionelle deutschsprachige Kundenkommunikation. Du schreibst empathische, authentische Google-Bewertungsantworten.",
      messages: [{ role: "user", content: prompt }],
    });

    const replyBlock = message.content[0];
    const reply = replyBlock.type === "text"
      ? replyBlock.text.trim()
      : "Vielen Dank für Ihre Bewertung! Wir freuen uns über Ihr Feedback.";
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

// ─── GOOGLE BUSINESS PROFILE SYNC (full reviews, no 5-review limit) ──────────
router.post("/sync-gmb", async (req, res) => {
  try {
    const { brandId } = req.body;
    if (!brandId) return res.status(400).json({ error: "brandId required" });

    const tokens = await getValidTokens(parseInt(brandId));
    if (!tokens) {
      return res.status(401).json({
        error: "Chưa kết nối Google Business Profile. Vui lòng kết nối trước.",
      });
    }

    // account_id may be empty if the GMB accounts API call failed at OAuth time — recover now
    let accountId = tokens.account_id as string;
    if (!accountId) {
      console.log("[sync-gmb] account_id missing — attempting to fetch from GMB API...");
      const result = await ensureAccountId(parseInt(brandId), tokens.access_token as string);
      accountId = result.accountId ?? "";
      if (!accountId) {
        return res.status(400).json({
          error: result.rateLimited
            ? "API Google đang trong thời gian chờ (quota). Dùng 'Nhập thủ công' bên dưới để thiết lập ngay."
            : result.apiEnableUrl
              ? "Chưa bật API 'My Business Account Management'. Nhấn nút bên dưới để bật rồi thử lại."
              : "Không thể lấy Account ID. Dùng 'Nhập thủ công' bên dưới.",
          apiEnableUrl: result.apiEnableUrl,
          rateLimited: result.rateLimited ?? false,
          showManual: true,
        });
      }
      console.log(`[sync-gmb] Recovered account_id: ${accountId}`);
    }

    // Determine location path: stored or auto-fetched first location
    let locationPath = tokens.location_id as string | null;
    if (!locationPath) {
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${tokens.access_token as string}` } }
      );
      const locData = (await locRes.json()) as Record<string, any>;
      const locations: any[] = locData.locations ?? [];
      if (locations.length > 0) {
        locationPath = locations[0].name as string;
        // Persist the auto-selected location
        await db.execute(sql`
          UPDATE google_oauth_tokens
          SET location_id = ${locationPath}, updated_at = NOW()
          WHERE brand_id = ${parseInt(brandId)}
        `);
      }
    }

    if (!locationPath) {
      return res.status(400).json({
        error: "Không tìm thấy địa điểm nào trong Google Business Profile.",
      });
    }

    // Paginate through ALL reviews — no artificial cap
    let pageToken = "";
    let allReviews: any[] = [];

    do {
      const url = new URL(`https://mybusiness.googleapis.com/v4/${locationPath}/reviews`);
      url.searchParams.set("pageSize", "50");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const reviewsRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${tokens.access_token as string}` },
      });
      const reviewsData = (await reviewsRes.json()) as Record<string, any>;

      if (!reviewsRes.ok) {
        console.error("[sync-gmb] Business Profile API error:", reviewsData);
        // If we already have some reviews, return partial success rather than failing entirely
        if (allReviews.length > 0) {
          console.warn(`[sync-gmb] Partial sync: ${allReviews.length} reviews fetched before error`);
          break;
        }
        return res.status(400).json({
          error: reviewsData.error?.message ?? "Lỗi từ Google Business Profile API",
        });
      }

      const page: any[] = reviewsData.reviews ?? [];
      allReviews = allReviews.concat(page);
      pageToken = reviewsData.nextPageToken ?? "";

      // Safety: stop if a page returns 0 reviews to prevent infinite loop
      if (page.length === 0) break;
    } while (pageToken);

    // GMB API rating map
    const ratingMap: Record<string, number> = {
      ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
    };

    let imported = 0;
    let skipped = 0;

    for (const gr of allReviews) {
      const googleReviewId = (gr.reviewId as string) ?? (gr.name as string);
      const existing = await db.execute(sql`
        SELECT id FROM reviews
        WHERE brand_id = ${parseInt(brandId)} AND google_review_id = ${googleReviewId}
        LIMIT 1
      `);
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(reviewsTable).values({
        brandId: parseInt(brandId),
        reviewerName: (gr.reviewer?.displayName as string) ?? "Anonym",
        rating: ratingMap[gr.starRating as string] ?? 5,
        reviewText: (gr.comment as string) ?? null,
        reviewDate: gr.createTime ? new Date(gr.createTime as string) : new Date(),
        replied: !!(gr.reviewReply),
        replyText: (gr.reviewReply?.comment as string) ?? null,
        googleReviewId,
      });
      imported++;
    }

    res.json({ success: true, imported, skipped, total: allReviews.length });
  } catch (error) {
    console.error("[sync-gmb] Unexpected error:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi đồng bộ Google Business Profile." });
  }
});

// ─── REPLY TO GOOGLE MAPS (via Business Profile API) ─────────────────────────
router.post("/reply-gmb/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { replyText } = req.body as { replyText?: string };
    if (!replyText) return res.status(400).json({ error: "replyText required" });

    const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    if (!review) return res.status(404).json({ error: "Review not found" });

    const tokens = await getValidTokens(review.brandId);
    if (!tokens) {
      return res.status(401).json({ error: "Chưa kết nối Google Business Profile." });
    }

    const googleReviewId = review.googleReviewId;
    if (!googleReviewId) {
      return res.status(400).json({ error: "Review này không có Google Review ID." });
    }

    const locationPath = tokens.location_id as string;
    if (!locationPath) {
      return res.status(400).json({ error: "Chưa chọn địa điểm trong Google Business Profile." });
    }

    // Build the full review resource name for the reply endpoint
    // Format: accounts/{accountId}/locations/{locationId}/reviews/{reviewId}
    const reviewName = googleReviewId.startsWith("accounts/")
      ? googleReviewId
      : `${locationPath}/reviews/${googleReviewId}`;

    const replyRes = await fetch(`https://mybusiness.googleapis.com/v4/${reviewName}/reply`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${tokens.access_token as string}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: replyText }),
    });

    if (!replyRes.ok) {
      const errData = (await replyRes.json()) as Record<string, any>;
      console.error("[reply-gmb] Google API error:", errData);
      return res.status(400).json({
        error: (errData.error?.message as string) ?? "Không thể đăng phản hồi lên Google.",
        raw: errData,
      });
    }

    // Also persist locally
    const [updated] = await db
      .update(reviewsTable)
      .set({ replied: true, replyText, replyDate: new Date() })
      .where(eq(reviewsTable.id, id))
      .returning();

    res.json({ success: true, review: updated });
  } catch (error) {
    console.error("[reply-gmb] Unexpected error:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi đăng phản hồi lên Google." });
  }
});

export default router;
