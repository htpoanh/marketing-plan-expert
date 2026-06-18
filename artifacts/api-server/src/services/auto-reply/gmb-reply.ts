/**
 * Phase G — push a reply to a Google Business Profile review.
 *
 * Mirrors the logic in routes/reviews.ts POST /reply-gmb/:id but as a reusable
 * service the hourly auto-reply job can call. On success it persists the reply
 * back onto the reviews row (replied=true) just like the manual path.
 */

import { db } from "@workspace/db";
import { reviewsTable, type Review } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getValidTokens } from "../../routes/google-auth";

export type GmbReplyResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

export async function postGmbReply(
  review: Review,
  replyText: string,
): Promise<GmbReplyResult> {
  const tokens = await getValidTokens(review.brandId);
  if (!tokens) {
    return { ok: false, status: 401, error: "Chưa kết nối Google Business Profile." };
  }

  const googleReviewId = review.googleReviewId;
  if (!googleReviewId) {
    return { ok: false, status: 400, error: "Review không có Google Review ID." };
  }

  const locationPath = tokens.location_id as string | null;
  if (!locationPath) {
    return { ok: false, status: 400, error: "Chưa chọn địa điểm trong Google Business Profile." };
  }

  const reviewName = googleReviewId.startsWith("accounts/")
    ? googleReviewId
    : `${locationPath}/reviews/${googleReviewId}`;

  try {
    const replyRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokens.access_token as string}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: replyText }),
      },
    );

    if (!replyRes.ok) {
      const errData = (await replyRes.json().catch(() => ({}))) as Record<string, any>;
      return {
        ok: false,
        status: replyRes.status,
        error: (errData.error?.message as string) ?? "Không thể đăng phản hồi lên Google.",
      };
    }

    await db
      .update(reviewsTable)
      .set({ replied: true, replyText, replyDate: new Date() })
      .where(eq(reviewsTable.id, review.id));

    return { ok: true, status: replyRes.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
