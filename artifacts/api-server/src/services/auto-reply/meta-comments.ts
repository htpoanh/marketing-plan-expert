/**
 * Phase G — Meta Graph API helpers for replying to FB/IG comments.
 *
 * Three delivery shapes:
 *   - replyToCommentPublic()  → posts a public reply UNDER the comment
 *   - privateReplyToComment()  → opens a Messenger DM seeded from the comment
 *                                (Meta "private replies"); 7-day window after
 *                                the comment, one private reply per comment.
 *   - replyToInstagramComment()→ public reply on an IG comment
 *
 * All return a structured result; callers persist what actually happened.
 */

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

export type GraphResult = {
  ok: boolean;
  id?: string;
  status?: number;
  error?: string;
};

async function postGraph(
  url: string,
  token: string,
  body: Record<string, unknown>,
): Promise<GraphResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: (data.error?.message as string) ?? `Graph HTTP ${res.status}`,
      };
    }
    return { ok: true, id: (data.id as string) ?? undefined, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Public reply posted under a Facebook page comment. */
export function replyToCommentPublic(
  commentId: string,
  pageAccessToken: string,
  message: string,
): Promise<GraphResult> {
  return postGraph(`${GRAPH_BASE}/${commentId}/comments`, pageAccessToken, {
    message,
  });
}

/**
 * Private reply — turns a public FB comment into a Messenger DM.
 * Uses the page's /me/messages endpoint with recipient.comment_id.
 */
export function privateReplyToComment(
  commentId: string,
  pageAccessToken: string,
  message: string,
): Promise<GraphResult> {
  return postGraph(`${GRAPH_BASE}/me/messages`, pageAccessToken, {
    recipient: { comment_id: commentId },
    message: { text: message },
    messaging_type: "RESPONSE",
  });
}

/** Public reply on an Instagram comment. */
export function replyToInstagramComment(
  igCommentId: string,
  pageAccessToken: string,
  message: string,
): Promise<GraphResult> {
  return postGraph(`${GRAPH_BASE}/${igCommentId}/replies`, pageAccessToken, {
    message,
  });
}

/**
 * Private reply on an Instagram comment (DM). Same private-reply mechanism via
 * /me/messages with recipient.comment_id — works for IG when the page is
 * linked to an IG professional account.
 */
export function privateReplyToInstagramComment(
  igCommentId: string,
  pageAccessToken: string,
  message: string,
): Promise<GraphResult> {
  return postGraph(`${GRAPH_BASE}/me/messages`, pageAccessToken, {
    recipient: { comment_id: igCommentId },
    message: { text: message },
    messaging_type: "RESPONSE",
  });
}
