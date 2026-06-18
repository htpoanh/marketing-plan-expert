/**
 * Phase G — handle one inbound FB/IG comment end-to-end.
 *
 * Called from the Messenger webhook when an `entry.changes` comment event
 * arrives. Pipeline:
 *   classify intent → decide action (rules) → draft reply → guards →
 *   send (public/private via Graph) or escalate → persist reply_queue row.
 *
 * Always swallows its own errors (logs + persists) so a single bad comment
 * never breaks webhook processing for the rest of the batch.
 */

import { db } from "@workspace/db";
import {
  replyQueueTable,
  autoReplySettingsTable,
  type ReplyPlatform,
  type InsertReplyQueueRow,
} from "@workspace/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  classifyIntentByKeywords,
  refineIntentWithAI,
} from "./intent-classifier";
import { decideCommentAction } from "./reply-rules";
import { checkOutgoingReply, isDailyCapReached, isTooNegativeToAutoSend } from "./guards";
import { generateReply } from "./reply-generator";
import {
  replyToCommentPublic,
  privateReplyToComment,
  replyToInstagramComment,
  privateReplyToInstagramComment,
  type GraphResult,
} from "./meta-comments";

export type CommentEvent = {
  platform: Extract<ReplyPlatform, "facebook" | "instagram">;
  commentId: string;
  text: string;
  authorName?: string;
  brand: { id: number; brandName?: string | null; brandVoice?: string | null; industry?: string | null };
  pageAccessToken: string;
};

const DEFAULT_DAILY_CAP = 50;

async function countAutoSentToday(brandId: number, platform: ReplyPlatform): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(replyQueueTable)
    .where(
      and(
        eq(replyQueueTable.brandId, brandId),
        eq(replyQueueTable.platform, platform),
        eq(replyQueueTable.status, "auto_sent"),
        gte(replyQueueTable.createdAt, startOfDay),
      ),
    );
  return rows[0]?.count ?? 0;
}

async function alreadyProcessed(brandId: number, commentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: replyQueueTable.id })
    .from(replyQueueTable)
    .where(and(eq(replyQueueTable.brandId, brandId), eq(replyQueueTable.externalId, commentId)))
    .limit(1);
  return !!row;
}

async function sendComment(
  event: CommentEvent,
  mode: "public" | "private",
  message: string,
): Promise<GraphResult> {
  if (event.platform === "instagram") {
    return mode === "private"
      ? privateReplyToInstagramComment(event.commentId, event.pageAccessToken, message)
      : replyToInstagramComment(event.commentId, event.pageAccessToken, message);
  }
  return mode === "private"
    ? privateReplyToComment(event.commentId, event.pageAccessToken, message)
    : replyToCommentPublic(event.commentId, event.pageAccessToken, message);
}

export async function handleCommentEvent(event: CommentEvent): Promise<void> {
  try {
    // Idempotency: never process the same comment twice.
    if (await alreadyProcessed(event.brand.id, event.commentId)) return;

    // Per-brand settings (missing row = all disabled).
    const [settings] = await db
      .select()
      .from(autoReplySettingsTable)
      .where(eq(autoReplySettingsTable.brandId, event.brand.id));

    const platformEnabled =
      event.platform === "facebook"
        ? !!settings?.fbCommentsEnabled
        : !!settings?.igCommentsEnabled;

    // Classify (keyword first, AI refine only when ambiguous).
    let intentResult = classifyIntentByKeywords(event.text);
    if (intentResult.intent === "other") {
      intentResult = await refineIntentWithAI(event.text, intentResult);
    }

    const decision = decideCommentAction({ intent: intentResult.intent, platformEnabled });

    // Draft the reply (unless we're just escalating a complaint without a draft).
    let suggested = "";
    if (decision.action !== "escalate") {
      const drafted = await generateReply({
        brand: event.brand,
        channel: event.platform,
        message: event.text,
        intent: intentResult.intent,
        replyMode: decision.replyMode,
      });
      suggested = drafted.reply;
    }

    const baseRow: InsertReplyQueueRow = {
      brandId: event.brand.id,
      platform: event.platform,
      externalId: event.commentId,
      authorName: event.authorName ?? null,
      originalMessage: event.text,
      suggestedReply: suggested || null,
      replyMode: decision.replyMode,
      intent: intentResult.intent,
      sentiment: intentResult.sentiment.toFixed(2),
    };

    // Decide final disposition with guards layered on top of the rules.
    if (decision.action === "auto_send") {
      const guard = checkOutgoingReply(suggested);
      const capReached = isDailyCapReached(
        await countAutoSentToday(event.brand.id, event.platform),
        settings?.dailyCap ?? DEFAULT_DAILY_CAP,
      );
      const tooNegative = isTooNegativeToAutoSend(intentResult.sentiment);

      if (!guard.ok || capReached || tooNegative) {
        await db.insert(replyQueueTable).values({
          ...baseRow,
          status: "pending",
          statusReason: !guard.ok
            ? guard.reason
            : capReached
              ? "Tageslimit erreicht — Entwurf wartet auf Freigabe"
              : "Negative Stimmung erkannt — manuelle Prüfung",
        });
        return;
      }

      const sent = await sendComment(event, decision.replyMode, suggested);
      await db.insert(replyQueueTable).values({
        ...baseRow,
        status: sent.ok ? "auto_sent" : "pending",
        statusReason: sent.ok ? decision.reason : `Senden fehlgeschlagen: ${sent.error}`,
        sentReply: sent.ok ? suggested : null,
        sentAt: sent.ok ? new Date() : null,
      });
      return;
    }

    // escalate | queue → persist for human handling, never auto-send.
    await db.insert(replyQueueTable).values({
      ...baseRow,
      status: decision.resultingStatus,
      statusReason: decision.reason,
    });
  } catch (e) {
    console.error("[auto-reply] handleCommentEvent error:", e);
  }
}
