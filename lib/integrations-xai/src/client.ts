import OpenAI from "openai";

/**
 * xAI (Grok) is OpenAI-compatible. We reuse the `openai` SDK with a different
 * baseURL + key. Default model: `grok-3` for trend pulse / real-time search.
 */

const apiKey =
  process.env.AI_INTEGRATIONS_XAI_API_KEY ??
  process.env.GROK_API_KEY ??
  process.env.XAI_API_KEY;

if (!apiKey) {
  throw new Error(
    "xAI / Grok API key is missing. Set GROK_API_KEY (or AI_INTEGRATIONS_XAI_API_KEY).",
  );
}

const baseURL =
  process.env.AI_INTEGRATIONS_XAI_BASE_URL ??
  process.env.XAI_BASE_URL ??
  "https://api.x.ai/v1";

export const grok = new OpenAI({
  apiKey,
  baseURL,
});

export const DEFAULT_GROK_MODEL = "grok-3";
