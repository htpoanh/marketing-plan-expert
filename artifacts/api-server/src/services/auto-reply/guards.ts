/**
 * Phase G — safety guards (pure predicates).
 *
 * Per v3.0 "Safety Guards":
 *   - KHÔNG đề cập refund/discount tự động  → block outgoing text that promises
 *     money back / discounts / freebies the human didn't approve
 *   - Max 50 replies/ngày/page                → daily cap check
 *   - KHÔNG auto-reply complaint 1-2 sao      → enforced in reply-rules, but we
 *     double-check sentiment here as defence in depth
 *
 * DB counting lives in the caller (job/handler); these stay pure so they can be
 * unit-tested without a database.
 */

/** German + English money/discount terms we must never auto-promise. */
const PROHIBITED_TERMS = [
  "rückerstattung", "rueckerstattung", "erstattung", "geld zurück", "geld zurueck",
  "rabatt", "gutschein", "gutscheincode", "kostenlos gratis", "gratis",
  "discount", "refund", "voucher", "free of charge", "% off", "prozent rabatt",
  "auf uns", "geht auf uns", "einladen wir",
];

export type GuardResult = { ok: boolean; reason?: string };

/** True-positive blocking: returns ok:false if the reply promises money/discounts. */
export function checkOutgoingReply(text: string): GuardResult {
  const haystack = (text ?? "").toLowerCase();
  const hit = PROHIBITED_TERMS.find((t) => haystack.includes(t));
  if (hit) {
    return {
      ok: false,
      reason: `Antwort enthält unzulässige Zusage ("${hit}") — wird zur manuellen Freigabe eskaliert`,
    };
  }
  return { ok: true };
}

/** True when the brand has hit its per-platform daily auto-send cap. */
export function isDailyCapReached(sentToday: number, dailyCap: number): boolean {
  return sentToday >= dailyCap;
}

/**
 * Defence in depth: even if rule logic says auto-send, refuse when sentiment is
 * clearly negative (e.g. a "compliment" keyword inside an angry message).
 */
export function isTooNegativeToAutoSend(sentiment: number): boolean {
  return sentiment <= -0.3;
}
