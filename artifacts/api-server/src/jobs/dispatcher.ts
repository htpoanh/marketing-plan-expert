/**
 * Outbound dispatcher for digest payloads.
 *
 * Resolution order:
 *   1. TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID  → direct Telegram Bot API
 *   2. OUTBOUND_WEBHOOK_URL                     → POST JSON to a generic webhook
 *   3. (no env)                                 → log + persist payload only
 *
 * Always returns a structured result so the caller can persist what
 * actually happened to scheduled_runs.summary.
 */

export type DispatchTarget = "telegram" | "webhook" | "none";

export type DispatchResult = {
  target: DispatchTarget;
  ok: boolean;
  status?: number;
  error?: string;
};

export type DispatchPayload = {
  /** Free-form event identifier, e.g. "weekly_trend_digest". */
  eventType: string;
  /** Markdown-friendly text body for Telegram / fallback display. */
  text: string;
  /** Optional structured data for the webhook consumer. */
  data?: Record<string, unknown>;
};

const TELEGRAM_API_BASE = "https://api.telegram.org";

export async function dispatchDigest(
  payload: DispatchPayload,
): Promise<DispatchResult> {
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;
  const webhookUrl = process.env.OUTBOUND_WEBHOOK_URL;

  if (tgToken && tgChatId) {
    return sendTelegram(tgToken, tgChatId, payload);
  }
  if (webhookUrl) {
    return sendWebhook(webhookUrl, payload);
  }
  console.warn(
    `[dispatcher] No TELEGRAM_BOT_TOKEN/CHAT_ID or OUTBOUND_WEBHOOK_URL set — payload not delivered. Event: ${payload.eventType}`,
  );
  return { target: "none", ok: false, error: "no delivery target configured" };
}

async function sendTelegram(
  token: string,
  chatId: string,
  payload: DispatchPayload,
): Promise<DispatchResult> {
  try {
    // Telegram caps a single message at 4096 chars. Truncate gracefully.
    const text =
      payload.text.length > 4000
        ? payload.text.slice(0, 3997) + "..."
        : payload.text;

    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")) || "";
      return {
        target: "telegram",
        ok: false,
        status: res.status,
        error: `Telegram HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    return { target: "telegram", ok: true, status: res.status };
  } catch (e) {
    return {
      target: "telegram",
      ok: false,
      error: `Telegram dispatch threw: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function sendWebhook(
  url: string,
  payload: DispatchPayload,
): Promise<DispatchResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: payload.eventType,
        text: payload.text,
        data: payload.data ?? {},
      }),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")) || "";
      return {
        target: "webhook",
        ok: false,
        status: res.status,
        error: `Webhook HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    return { target: "webhook", ok: true, status: res.status };
  } catch (e) {
    return {
      target: "webhook",
      ok: false,
      error: `Webhook dispatch threw: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
