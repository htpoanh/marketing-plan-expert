/**
 * Phase G — decision rules (pure functions, fully testable offline).
 *
 * Review rules (v3.0):
 *   - 5★            → auto-send immediately
 *   - 3-4★          → auto-send + subtle "come back" invite
 *   - <= threshold  → escalate (queue + Telegram alert), NEVER auto-send
 *
 * Comment rules (decision: public for compliments, private for booking/price):
 *   - compliment    → auto, public reply
 *   - booking/price → auto, private reply (move to DM)
 *   - complaint     → escalate, never auto-send
 *   - other         → queue as pending for human review (no auto-send)
 */

import type { Intent } from "./intent-classifier";
import type { ReplyStatus } from "@workspace/db/schema";

export type ReviewDecision = {
  action: "auto_send" | "escalate";
  /** Whether the reply should include a subtle invitation to return. */
  addInvite: boolean;
  reason: string;
};

export function decideReviewAction(params: {
  rating: number;
  escalateThreshold: number;
}): ReviewDecision {
  const { rating, escalateThreshold } = params;

  if (rating <= escalateThreshold) {
    return {
      action: "escalate",
      addInvite: false,
      reason: `Bewertung ${rating}★ ≤ Eskalations-Schwelle ${escalateThreshold} — manuelle Bearbeitung`,
    };
  }

  // 3-4★ get a gentle invite; 5★ are already delighted.
  const addInvite = rating < 5;
  return {
    action: "auto_send",
    addInvite,
    reason: `Bewertung ${rating}★ — automatische Antwort${addInvite ? " mit Einladung" : ""}`,
  };
}

export type CommentDecision = {
  action: "auto_send" | "escalate" | "queue";
  replyMode: "public" | "private";
  /** Maps onto reply_queue.status once acted upon. */
  resultingStatus: Extract<ReplyStatus, "auto_sent" | "escalated" | "pending">;
  reason: string;
};

export function decideCommentAction(params: {
  intent: Intent;
  /** Whether auto-reply is enabled for this platform on this brand. */
  platformEnabled: boolean;
}): CommentDecision {
  const { intent, platformEnabled } = params;

  if (intent === "complaint") {
    return {
      action: "escalate",
      replyMode: "private",
      resultingStatus: "escalated",
      reason: "Beschwerde erkannt — wird zur manuellen Bearbeitung eskaliert",
    };
  }

  // If the channel isn't enabled, draft + queue for human (never auto-send).
  if (!platformEnabled) {
    return {
      action: "queue",
      replyMode: intent === "compliment" ? "public" : "private",
      resultingStatus: "pending",
      reason: "Auto-Reply für diese Plattform deaktiviert — Entwurf wartet auf Freigabe",
    };
  }

  if (intent === "compliment") {
    return {
      action: "auto_send",
      replyMode: "public",
      resultingStatus: "auto_sent",
      reason: "Kompliment — öffentliche Dankesantwort",
    };
  }

  if (intent === "booking" || intent === "price") {
    return {
      action: "auto_send",
      replyMode: "private",
      resultingStatus: "auto_sent",
      reason: `${intent === "booking" ? "Terminanfrage" : "Preisanfrage"} — private Antwort (DM)`,
    };
  }

  // "other" — draft + queue for human review.
  return {
    action: "queue",
    replyMode: "private",
    resultingStatus: "pending",
    reason: "Kein klarer Intent — Entwurf wartet auf Freigabe",
  };
}
