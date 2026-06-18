/**
 * Hourly Google Review Auto-Reply job.
 *
 * For every brand with auto_reply_settings.googleEnabled:
 *   1. Sync the latest GMB reviews (reuse syncGmbForBrand — best effort)
 *   2. For each unreplied review, apply the rating rules:
 *        - rating  > escalateThreshold → draft + guard + push reply to Google
 *        - rating <= escalateThreshold → escalate (queue + Telegram alert)
 *   3. Respect the per-brand daily cap on auto-sent replies
 *   4. Dispatch a Telegram alert summarising any escalations
 *   5. Audit-log the run in scheduled_runs
 *
 * Disabled by default (scheduled_jobs seed). The user opts in from /inbox.
 */
import { db } from "@workspace/db";
import {
  brandsTable,
  reviewsTable,
  autoReplySettingsTable,
  replyQueueTable,
  scheduledRunsTable,
  type Brand,
  type Review,
  type ScheduledRunStatus,
} from "@workspace/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { syncGmbForBrand } from "../../routes/reviews";
import { postGmbReply } from "../../services/auto-reply/gmb-reply";
import { generateReply } from "../../services/auto-reply/reply-generator";
import { decideReviewAction } from "../../services/auto-reply/reply-rules";
import { checkOutgoingReply, isDailyCapReached } from "../../services/auto-reply/guards";
import { dispatchDigest } from "../dispatcher";

export const REVIEW_AUTO_REPLY_KEY = "review_auto_reply";

type Escalation = { brandName: string; author: string; rating: number; text: string };

type BrandResult = {
  brandId: number;
  brandName: string;
  ok: boolean;
  autoSent: number;
  escalated: number;
  held: number;
  error?: string;
};

// ── Pure formatter (testable without DB / network) ───────────────────────────
export function formatEscalationAlert(
  escalations: Escalation[],
  generatedAt: Date,
): string {
  const lines: string[] = [];
  lines.push("⚠️ *Auto-Reply: Eskalierte Bewertungen*");
  lines.push(
    `_${generatedAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} (Europe/Berlin)_`,
  );
  lines.push("");
  lines.push(`Negative Bewertungen, die manuelle Bearbeitung brauchen: *${escalations.length}*`);
  lines.push("");
  for (const e of escalations) {
    const stars = "★".repeat(e.rating) + "☆".repeat(5 - e.rating);
    lines.push(`• *${e.brandName}* — ${stars} von ${e.author}`);
    if (e.text) lines.push(`  _"${e.text.slice(0, 160)}"_`);
  }
  lines.push("");
  lines.push("→ Im /inbox unter „Google Reviews“ bearbeiten.");
  return lines.join("\n").trim();
}

async function countGoogleAutoSentToday(brandId: number): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(replyQueueTable)
    .where(
      and(
        eq(replyQueueTable.brandId, brandId),
        eq(replyQueueTable.platform, "google"),
        eq(replyQueueTable.status, "auto_sent"),
        gte(replyQueueTable.createdAt, startOfDay),
      ),
    );
  return rows[0]?.count ?? 0;
}

async function alreadyQueued(brandId: number, externalId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: replyQueueTable.id })
    .from(replyQueueTable)
    .where(and(eq(replyQueueTable.brandId, brandId), eq(replyQueueTable.externalId, externalId)))
    .limit(1);
  return !!row;
}

async function processBrand(
  brand: Brand,
  escalateThreshold: number,
  dailyCap: number,
  escalationsOut: Escalation[],
): Promise<BrandResult> {
  const result: BrandResult = {
    brandId: brand.id,
    brandName: brand.brandName,
    ok: true,
    autoSent: 0,
    escalated: 0,
    held: 0,
  };

  // Best-effort sync; if it fails we still process whatever is already in DB.
  try {
    await syncGmbForBrand(brand.id);
  } catch (e) {
    console.warn(`[review-auto-reply] sync failed for brand ${brand.id}: ${String(e)}`);
  }

  const unreplied: Review[] = await db
    .select()
    .from(reviewsTable)
    .where(and(eq(reviewsTable.brandId, brand.id), eq(reviewsTable.replied, false)));

  let sentToday = await countGoogleAutoSentToday(brand.id);

  for (const review of unreplied) {
    const externalId = review.googleReviewId ?? `review-${review.id}`;
    if (await alreadyQueued(brand.id, externalId)) continue;

    const decision = decideReviewAction({ rating: review.rating, escalateThreshold });

    if (decision.action === "escalate") {
      await db.insert(replyQueueTable).values({
        brandId: brand.id,
        platform: "google",
        externalId,
        reviewId: review.id,
        authorName: review.reviewerName,
        rating: review.rating,
        originalMessage: review.reviewText,
        intent: "complaint",
        status: "escalated",
        statusReason: decision.reason,
      });
      result.escalated++;
      escalationsOut.push({
        brandName: brand.brandName,
        author: review.reviewerName,
        rating: review.rating,
        text: review.reviewText ?? "",
      });
      continue;
    }

    // auto_send path — respect daily cap
    if (isDailyCapReached(sentToday, dailyCap)) {
      await db.insert(replyQueueTable).values({
        brandId: brand.id,
        platform: "google",
        externalId,
        reviewId: review.id,
        authorName: review.reviewerName,
        rating: review.rating,
        originalMessage: review.reviewText,
        status: "pending",
        statusReason: "Tageslimit erreicht — Entwurf wartet auf Freigabe",
      });
      result.held++;
      continue;
    }

    let reply: string;
    try {
      const drafted = await generateReply({
        brand,
        channel: "google",
        message: review.reviewText ?? "",
        rating: review.rating,
        addInvite: decision.addInvite,
        replyMode: "public",
      });
      reply = drafted.reply;
    } catch (e) {
      result.error = `Reply-Generierung fehlgeschlagen: ${String(e)}`;
      result.ok = false;
      break;
    }

    const guard = checkOutgoingReply(reply);
    if (!guard.ok) {
      await db.insert(replyQueueTable).values({
        brandId: brand.id,
        platform: "google",
        externalId,
        reviewId: review.id,
        authorName: review.reviewerName,
        rating: review.rating,
        originalMessage: review.reviewText,
        suggestedReply: reply,
        status: "pending",
        statusReason: guard.reason,
      });
      result.held++;
      continue;
    }

    const pushed = await postGmbReply(review, reply);
    await db.insert(replyQueueTable).values({
      brandId: brand.id,
      platform: "google",
      externalId,
      reviewId: review.id,
      authorName: review.reviewerName,
      rating: review.rating,
      originalMessage: review.reviewText,
      suggestedReply: reply,
      replyMode: "public",
      status: pushed.ok ? "auto_sent" : "pending",
      statusReason: pushed.ok ? decision.reason : `Senden fehlgeschlagen: ${pushed.error}`,
      sentReply: pushed.ok ? reply : null,
      sentAt: pushed.ok ? new Date() : null,
    });

    if (pushed.ok) {
      result.autoSent++;
      sentToday++;
    } else {
      result.held++;
    }
  }

  return result;
}

export type RunOptions = { trigger: "cron" | "manual" };

export async function runReviewAutoReply(
  options: RunOptions,
): Promise<{ runId: number; status: ScheduledRunStatus }> {
  const startedAt = Date.now();

  const [running] = await db
    .insert(scheduledRunsTable)
    .values({ jobKey: REVIEW_AUTO_REPLY_KEY, status: "running", trigger: options.trigger })
    .returning();
  const runId = running.id;

  try {
    // Brands that have opted in to Google auto-reply.
    const settingsRows = await db
      .select()
      .from(autoReplySettingsTable)
      .where(eq(autoReplySettingsTable.googleEnabled, true));

    if (settingsRows.length === 0) {
      await finishRun(runId, {
        status: "success",
        summary: { message: "Kein Brand hat Google-Auto-Reply aktiviert." },
        brandsProcessed: 0,
        brandsFailed: 0,
        durationMs: Date.now() - startedAt,
      });
      return { runId, status: "success" };
    }

    const escalations: Escalation[] = [];
    const results: BrandResult[] = [];

    for (const settings of settingsRows) {
      const [brand] = await db
        .select()
        .from(brandsTable)
        .where(eq(brandsTable.id, settings.brandId));
      if (!brand) continue;
      try {
        results.push(
          await processBrand(brand, settings.escalateThreshold, settings.dailyCap, escalations),
        );
      } catch (e) {
        results.push({
          brandId: brand.id,
          brandName: brand.brandName,
          ok: false,
          autoSent: 0,
          escalated: 0,
          held: 0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Telegram alert for escalations (only if there are any).
    let dispatch = null;
    if (escalations.length > 0) {
      const alert = formatEscalationAlert(escalations, new Date());
      dispatch = await dispatchDigest({
        eventType: REVIEW_AUTO_REPLY_KEY,
        text: alert,
        data: { escalations },
      });
    }

    const failed = results.filter((r) => !r.ok).length;
    const processed = results.length - failed;
    const status: ScheduledRunStatus =
      failed === 0 ? "success" : processed === 0 ? "failed" : "partial";

    const totalAutoSent = results.reduce((s, r) => s + r.autoSent, 0);
    const totalEscalated = results.reduce((s, r) => s + r.escalated, 0);

    await finishRun(runId, {
      status,
      summary: { results, dispatch, totalAutoSent, totalEscalated },
      brandsProcessed: processed,
      brandsFailed: failed,
      durationMs: Date.now() - startedAt,
    });

    return { runId, status };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[review-auto-reply] FATAL", message);
    await finishRun(runId, {
      status: "failed",
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    return { runId, status: "failed" };
  }
}

async function finishRun(
  runId: number,
  patch: Partial<typeof scheduledRunsTable.$inferInsert>,
): Promise<void> {
  await db
    .update(scheduledRunsTable)
    .set({ ...patch, finishedAt: new Date() })
    .where(eq(scheduledRunsTable.id, runId));
}
