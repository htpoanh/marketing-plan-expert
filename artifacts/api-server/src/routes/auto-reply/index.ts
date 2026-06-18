import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  replyQueueTable,
  autoReplySettingsTable,
  reviewsTable,
  messengerConfigsTable,
  type ReplyPlatform,
  type ReplyStatus,
} from "@workspace/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { postGmbReply } from "../../services/auto-reply/gmb-reply";
import {
  replyToCommentPublic,
  privateReplyToComment,
  replyToInstagramComment,
  privateReplyToInstagramComment,
  type GraphResult,
} from "../../services/auto-reply/meta-comments";

const router: IRouter = Router();

const VALID_PLATFORMS: ReadonlyArray<ReplyPlatform> = [
  "google",
  "facebook",
  "instagram",
  "messenger",
];
const VALID_STATUSES: ReadonlyArray<ReplyStatus> = [
  "pending",
  "auto_sent",
  "manual_sent",
  "escalated",
  "skipped",
];

// ── GET /auto-reply/queue ────────────────────────────────────────────────────
router.get("/queue", async (req, res) => {
  try {
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
    const platform = req.query.platform as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    if (platform && !VALID_PLATFORMS.includes(platform as ReplyPlatform)) {
      return res.status(400).json({ error: `Invalid platform` });
    }
    if (status && !VALID_STATUSES.includes(status as ReplyStatus)) {
      return res.status(400).json({ error: `Invalid status` });
    }

    const conditions = [];
    if (brandId !== undefined && !Number.isNaN(brandId)) {
      conditions.push(eq(replyQueueTable.brandId, brandId));
    }
    if (platform) conditions.push(eq(replyQueueTable.platform, platform as ReplyPlatform));
    if (status) conditions.push(eq(replyQueueTable.status, status as ReplyStatus));

    const rows = await db
      .select()
      .from(replyQueueTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(replyQueueTable.createdAt))
      .limit(limit);

    return res.json(rows);
  } catch (error) {
    console.error("[auto-reply/queue] list failed", error);
    return res.status(500).json({ error: "Failed to list reply queue" });
  }
});

// ── PATCH /auto-reply/queue/:id (edit draft / skip) ──────────────────────────
router.patch("/queue/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const patch: { suggestedReply?: string | null; status?: ReplyStatus; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (typeof req.body?.suggestedReply === "string" || req.body?.suggestedReply === null) {
      patch.suggestedReply = req.body.suggestedReply;
    }
    // Only manual transitions allowed here.
    if (req.body?.status === "skipped" || req.body?.status === "pending") {
      patch.status = req.body.status;
    }

    const [row] = await db
      .update(replyQueueTable)
      .set(patch)
      .where(eq(replyQueueTable.id, id))
      .returning();

    if (!row) return res.status(404).json({ error: "Queue item not found" });
    return res.json(row);
  } catch (error) {
    console.error("[auto-reply/queue] update failed", error);
    return res.status(500).json({ error: "Failed to update queue item" });
  }
});

// ── POST /auto-reply/queue/:id/send (push reply + mark manual_sent) ──────────
router.post("/queue/:id/send", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [row] = await db.select().from(replyQueueTable).where(eq(replyQueueTable.id, id));
    if (!row) return res.status(404).json({ error: "Queue item not found" });

    const replyText =
      typeof req.body?.replyText === "string" && req.body.replyText.trim()
        ? req.body.replyText.trim()
        : row.suggestedReply;
    if (!replyText) {
      return res.status(400).json({ error: "Kein Antworttext vorhanden." });
    }

    let result: GraphResult | { ok: boolean; error?: string };

    if (row.platform === "google") {
      if (!row.reviewId) return res.status(400).json({ error: "Review-ID fehlt." });
      const [review] = await db
        .select()
        .from(reviewsTable)
        .where(eq(reviewsTable.id, row.reviewId));
      if (!review) return res.status(404).json({ error: "Zugehörige Bewertung nicht gefunden." });
      result = await postGmbReply(review, replyText);
    } else if (row.platform === "facebook" || row.platform === "instagram") {
      const [config] = await db
        .select()
        .from(messengerConfigsTable)
        .where(eq(messengerConfigsTable.brandId, row.brandId));
      if (!config?.pageAccessToken) {
        return res.status(400).json({ error: "Kein Page Access Token für diese Marke." });
      }
      if (!row.externalId) {
        return res.status(400).json({ error: "Kommentar-ID fehlt." });
      }
      const mode = row.replyMode ?? "public";
      if (row.platform === "instagram") {
        result =
          mode === "private"
            ? await privateReplyToInstagramComment(row.externalId, config.pageAccessToken, replyText)
            : await replyToInstagramComment(row.externalId, config.pageAccessToken, replyText);
      } else {
        result =
          mode === "private"
            ? await privateReplyToComment(row.externalId, config.pageAccessToken, replyText)
            : await replyToCommentPublic(row.externalId, config.pageAccessToken, replyText);
      }
    } else {
      return res.status(400).json({ error: "Senden für diese Plattform nicht unterstützt." });
    }

    if (!result.ok) {
      return res.status(400).json({ error: result.error ?? "Senden fehlgeschlagen." });
    }

    const [updated] = await db
      .update(replyQueueTable)
      .set({
        status: "manual_sent",
        sentReply: replyText,
        sentAt: new Date(),
        statusReason: "Manuell gesendet aus /inbox",
        updatedAt: new Date(),
      })
      .where(eq(replyQueueTable.id, id))
      .returning();

    return res.json(updated);
  } catch (error) {
    console.error("[auto-reply/queue] send failed", error);
    return res.status(500).json({ error: "Failed to send reply" });
  }
});

// ── GET /auto-reply/stats ────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
    const brandCond =
      brandId !== undefined && !Number.isNaN(brandId)
        ? [eq(replyQueueTable.brandId, brandId)]
        : [];

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [autoToday] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(replyQueueTable)
      .where(
        and(
          ...brandCond,
          sql`${replyQueueTable.status} IN ('auto_sent', 'manual_sent')`,
          gte(replyQueueTable.createdAt, startOfDay),
        ),
      );

    const [pending] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(replyQueueTable)
      .where(and(...brandCond, eq(replyQueueTable.status, "pending")));

    const [escalated] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(replyQueueTable)
      .where(and(...brandCond, eq(replyQueueTable.status, "escalated")));

    // Avg minutes between createdAt and sentAt for sent rows.
    const [avg] = await db
      .select({
        mins: sql<number | null>`avg(extract(epoch from (${replyQueueTable.sentAt} - ${replyQueueTable.createdAt})) / 60.0)`,
      })
      .from(replyQueueTable)
      .where(and(...brandCond, sql`${replyQueueTable.sentAt} IS NOT NULL`));

    return res.json({
      autoRepliedToday: autoToday?.count ?? 0,
      pending: pending?.count ?? 0,
      escalated: escalated?.count ?? 0,
      avgResponseMinutes: avg?.mins != null ? Math.round(Number(avg.mins) * 10) / 10 : null,
    });
  } catch (error) {
    console.error("[auto-reply/stats] failed", error);
    return res.status(500).json({ error: "Failed to compute stats" });
  }
});

const DEFAULT_SETTINGS = {
  googleEnabled: false,
  fbCommentsEnabled: false,
  igCommentsEnabled: false,
  dailyCap: 50,
  escalateThreshold: 2,
};

// ── GET /auto-reply/settings/:brandId ────────────────────────────────────────
router.get("/settings/:brandId", async (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId, 10);
    if (Number.isNaN(brandId)) return res.status(400).json({ error: "Invalid brandId" });

    const [row] = await db
      .select()
      .from(autoReplySettingsTable)
      .where(eq(autoReplySettingsTable.brandId, brandId));

    if (!row) {
      return res.json({ brandId, ...DEFAULT_SETTINGS });
    }
    return res.json({
      brandId: row.brandId,
      googleEnabled: row.googleEnabled,
      fbCommentsEnabled: row.fbCommentsEnabled,
      igCommentsEnabled: row.igCommentsEnabled,
      dailyCap: row.dailyCap,
      escalateThreshold: row.escalateThreshold,
    });
  } catch (error) {
    console.error("[auto-reply/settings] get failed", error);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// ── PATCH /auto-reply/settings/:brandId (upsert) ─────────────────────────────
router.patch("/settings/:brandId", async (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId, 10);
    if (Number.isNaN(brandId)) return res.status(400).json({ error: "Invalid brandId" });

    const body = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.googleEnabled === "boolean") patch.googleEnabled = body.googleEnabled;
    if (typeof body.fbCommentsEnabled === "boolean") patch.fbCommentsEnabled = body.fbCommentsEnabled;
    if (typeof body.igCommentsEnabled === "boolean") patch.igCommentsEnabled = body.igCommentsEnabled;
    if (typeof body.dailyCap === "number") patch.dailyCap = Math.max(1, Math.min(500, body.dailyCap));
    if (typeof body.escalateThreshold === "number")
      patch.escalateThreshold = Math.max(0, Math.min(5, body.escalateThreshold));

    const [existing] = await db
      .select()
      .from(autoReplySettingsTable)
      .where(eq(autoReplySettingsTable.brandId, brandId));

    let row;
    if (existing) {
      [row] = await db
        .update(autoReplySettingsTable)
        .set(patch)
        .where(eq(autoReplySettingsTable.brandId, brandId))
        .returning();
    } else {
      [row] = await db
        .insert(autoReplySettingsTable)
        .values({ brandId, ...DEFAULT_SETTINGS, ...patch })
        .returning();
    }

    return res.json({
      brandId: row.brandId,
      googleEnabled: row.googleEnabled,
      fbCommentsEnabled: row.fbCommentsEnabled,
      igCommentsEnabled: row.igCommentsEnabled,
      dailyCap: row.dailyCap,
      escalateThreshold: row.escalateThreshold,
    });
  } catch (error) {
    console.error("[auto-reply/settings] update failed", error);
    return res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
