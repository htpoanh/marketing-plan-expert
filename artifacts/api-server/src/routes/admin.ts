import { Router } from "express";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

function requireAdmin(req: any, res: any, next: any) {
  const pw = req.headers["x-admin-password"] ?? req.query.pw;
  if (!pw || pw !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.post("/seed", requireAdmin, async (req, res) => {
  try {
    const brandCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM brands`);
    const cnt = Number((brandCount.rows[0] as any).cnt);
    if (cnt > 0) {
      return res.json({ ok: true, message: `Database đã có dữ liệu (${cnt} brands). Dùng /admin/full-seed để copy toàn bộ.` });
    }

    await db.execute(sql`
      INSERT INTO ai_profiles (id, profile_name, industry, description, is_default, created_at, updated_at) VALUES
      (1, 'Mặc định',                 'Chung',                  NULL, true,  '2026-03-14 07:05:53', '2026-03-14 07:05:53'),
      (2, 'AI Nail Salon',            'Nail salon',             NULL, false, '2026-03-14 07:10:45', '2026-03-14 07:10:45'),
      (3, 'AI Nhà hàng',              'Nhà hàng / F&B',         NULL, false, '2026-03-14 12:35:22', '2026-03-14 12:35:22'),
      (4, 'AI Siêu thị / Tạp hóa',   'Siêu thị / Tạp hóa',    NULL, false, '2026-03-23 07:16:14', '2026-03-23 07:16:14')
      ON CONFLICT (id) DO NOTHING
    `);
    await db.execute(sql`SELECT setval('ai_profiles_id_seq', 4)`);

    await db.execute(sql`
      INSERT INTO brands (id, brand_name, industry, branch_location, target_audience, brand_voice, website_url, facebook_url, instagram_url, tiktok_url, google_place_id, created_at, updated_at, address, phone, business_hours, ai_profile_id) VALUES
      (1,'Happy Wok','F&B','cạnh siêu thị châu á, đối diện trường học nghề nhưng không có chỗ gửi xe. cạnh siêu thị Forum nhưng tỏng forum khách hàng có nhiều lựa chọn hơn','sinh viên  từ 18 , người đức. khách cần ăn take away. website https://www.happy-wok-imbiss.de','Năng động',NULL,NULL,NULL,NULL,'ChIJARXQggl5nEcRDXihr9Tz3_k','2026-03-14 05:45:10','2026-03-29 11:34:12','Kotterner Str. 48, 87435 Kempten (Allgäu)','+49 831 69729590',NULL,3),
      (2,'Paradise Nails Kempten','Nails and Beauty','đối diện trung tâm thương mại Forum Kempten','Phụ nữ quan tâm làm đẹp, làm móng, du lịch tại Kempten từ 13 tuổi, sử dụng tiktok, facebook, instagram','sang trọng',NULL,NULL,NULL,NULL,'ChIJ4avQJhF5nEcR_6Ng3txOarM','2026-03-14 08:27:37','2026-03-29 12:45:49','Kotternerstraße 70, 87435 Kempten',NULL,NULL,2),
      (3,'Paradise Nails Memmingen','Nails and Beauty','Khu phố cổ Memmingen','Phụ nữ quan tâm làm đẹp, làm móng, du lịch tại Kempten từ 13 tuổi, sử dụng tiktok, facebook, instagram','sang trọng, thích design',NULL,NULL,NULL,NULL,'ChIJ_VNDIjnzm0cRihVTeTf-nFI','2026-03-14 11:55:39','2026-03-14 11:58:17','Kramerstraße 10, 87700 Memmingen','+49 8331 9292662',NULL,2),
      (4,'Paradise Nails Lindau','Nails and Beauty','Điểm giao nhau của Áo-Đức-Thụy Sĩ','Phụ nữ quan tâm làm đẹp, làm móng, du lịch tại Kempten từ 13 tuổi, sử dụng tiktok, facebook, instagram','sang trọng',NULL,NULL,NULL,NULL,'ChIJYQmEhXkNm0cRurmnk3x7VT8','2026-03-14 11:56:27','2026-03-14 11:57:42','Rickenbacher straße8, 88131 Lindau','+49 8382 2737826',NULL,2),
      (5,'HaLong Nails im Förum Allgäu','Nails and Beauty','đối diện trung tâm thương mại Forum Kempten','Phụ nữ quan tâm làm đẹp, làm móng, du lịch tại Kempten từ 13 tuổi, sử dụng tiktok, facebook, instagram','sang trọng, lịch lãm đi mua sắm rồi làm nails',NULL,NULL,NULL,NULL,'ChIJlfPE3e55nEcRs6AMmh7FR3c','2026-03-14 11:58:26','2026-03-14 11:59:30','EG 1, August-Fischer-Platz 1, 87435 Kempten (Allgäu)','+49 831 575 38 38 9',NULL,2),
      (6,'Paradise Nails Friedrichshafen 1','Nails and Beauty','Khu vực dân giàu có, trung tâm phố đi bộ và sầm uất','Phụ nữ quan tâm làm đẹp, làm móng, du lịch tại Kempten từ 13 tuổi, sử dụng tiktok, facebook, instagram','sang trọng, thích design',NULL,NULL,NULL,NULL,'ChIJ4zoY4vwAm0cRWpmc7yQGFJY','2026-03-14 11:59:36','2026-03-14 12:01:39','Schanzstraße 16, 88045 Friedrichshafen','+49 75413783983',NULL,2),
      (7,'Paradise Nails Friedrichshafen 2','Nails and Beauty','Khu vực dân giàu có, trung tâm phố đi bộ và sầm uất','Phụ nữ quan tâm làm đẹp, làm móng, du lịch tại Kempten từ 13 tuổi, sử dụng tiktok, facebook, instagram','sang trọng, thích design',NULL,NULL,NULL,NULL,'ChIJOwHJZLMBm0cRqldeOXjv1A8','2026-03-14 12:00:59','2026-03-14 12:01:28','Karlstraße 38, 88045 Friedrichshafen','+49 75419412484',NULL,2),
      (8,'Coco Nails Kempten','Nails and Beauty','Phố đi bộ','Phụ nữ quan tâm làm đẹp, làm móng, du lịch tại Kempten từ 13 tuổi, sử dụng tiktok, facebook, instagram','trẻ trung thích design',NULL,NULL,NULL,NULL,'ChIJPatz8ER5nEcR7Gkny4F-K2M','2026-03-14 12:01:58','2026-03-14 12:03:48','Klostersteige 15, 87435 Kempten (Allgäu)','+49 1511 2322434',NULL,2),
      (9,'Asia Supermarkt Thai Hoang','F&B','siêu thị châu á với hơn 10000 mặt hàng thực phẩm khô, tươi đến từ châu á, đối diện trường học nghề nhưng không có chỗ gửi xe','Khách hàng đức và ngoại quốc yêu thích ẩm thực á đông','Năng động, tiềm năng',NULL,NULL,NULL,NULL,'ChIJ0yx2G395nEcRVQiPbCJTYjQ','2026-03-14 12:04:23','2026-03-23 07:27:22','Kotterner Str. 48, 87435 Kempten (Allgäu)','+4983169729590',NULL,4)
      ON CONFLICT (id) DO NOTHING
    `);
    await db.execute(sql`SELECT setval('brands_id_seq', 9)`);

    return res.json({ ok: true, message: "Seed thành công: 4 AI profiles + 9 brands. Dùng /admin/full-seed để copy toàn bộ dữ liệu." });
  } catch (e: any) {
    console.error("Seed error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/full-seed", requireAdmin, async (req, res) => {
  try {
    const sqlPath = path.join(__dirname, "seed_data.sql");
    if (!fs.existsSync(sqlPath)) {
      return res.status(500).json({ ok: false, error: `seed_data.sql not found at ${sqlPath}` });
    }

    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    const lines = sqlContent.split("\n");
    const statements: string[] = [];
    let current = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("--") || trimmed === "") {
        if (current.trim()) {
          statements.push(current.trim());
          current = "";
        }
        continue;
      }
      current += line + "\n";
      if (trimmed.endsWith(";")) {
        statements.push(current.trim());
        current = "";
      }
    }
    if (current.trim()) statements.push(current.trim());

    const client = await (pool as any).connect();
    let executed = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      for (const stmt of statements) {
        const s = stmt.trim();
        if (!s || s.startsWith("--")) continue;
        const upper = s.toUpperCase();
        if (upper.startsWith("SET ") || upper.startsWith("SELECT PG_CATALOG") || upper.startsWith("\\")) {
          skipped++;
          continue;
        }

        const isInsert = upper.startsWith("INSERT INTO PUBLIC.");
        const fixedStmt = isInsert ? s.replace(/INSERT INTO public\./i, "INSERT INTO ") : s;
        const onConflict = isInsert && !upper.includes("ON CONFLICT")
          ? fixedStmt.replace(/;$/, " ON CONFLICT DO NOTHING;")
          : fixedStmt;

        try {
          await client.query(onConflict);
          executed++;
        } catch (e: any) {
          errors.push(e.message.substring(0, 100));
          skipped++;
        }
      }
    } finally {
      client.release();
    }

    return res.json({
      ok: true,
      message: `Full seed hoàn tất: ${executed} statements thực thi, ${skipped} bỏ qua.`,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (e: any) {
    console.error("Full seed error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.get("/status", requireAdmin, async (req, res) => {
  try {
    const brands = await db.execute(sql`SELECT COUNT(*) as cnt FROM brands`);
    const reviews = await db.execute(sql`SELECT COUNT(*) as cnt FROM reviews`);
    const profiles = await db.execute(sql`SELECT COUNT(*) as cnt FROM ai_profiles`);
    const content = await db.execute(sql`SELECT COUNT(*) as cnt FROM content_plans`);
    const pipeline = await db.execute(sql`SELECT COUNT(*) as cnt FROM pipeline_runs`);
    const agents = await db.execute(sql`SELECT COUNT(*) as cnt FROM ai_agent_configs`);
    return res.json({
      ai_profiles: Number((profiles.rows[0] as any).cnt),
      brands: Number((brands.rows[0] as any).cnt),
      reviews: Number((reviews.rows[0] as any).cnt),
      content_plans: Number((content.rows[0] as any).cnt),
      pipeline_runs: Number((pipeline.rows[0] as any).cnt),
      ai_agent_configs: Number((agents.rows[0] as any).cnt),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
