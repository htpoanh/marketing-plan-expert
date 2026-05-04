/**
 * Grok 3 with Live Search (the xAI feature that lets the model query the
 * web / X / news in real time during inference). The OpenAI SDK's typed
 * surface doesn't expose `search_parameters`, so we go through raw fetch.
 *
 * Returns a shape similar enough to OpenAI's chat completion so callers can
 * pluck `text` + `usage` without learning a different API.
 */

const DEFAULT_BASE_URL =
  process.env.AI_INTEGRATIONS_XAI_BASE_URL ??
  process.env.XAI_BASE_URL ??
  "https://api.x.ai/v1";

export type LiveSearchSource =
  | { type: "web"; country?: string }
  | { type: "x" }
  | { type: "news"; country?: string };

export type LiveSearchOptions = {
  mode: "on" | "auto" | "off";
  sources?: LiveSearchSource[];
  maxSearchResults?: number;
};

export type GrokChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GrokChatRequest = {
  model: string;
  messages: GrokChatMessage[];
  /** JSON-mode hint. Optional. */
  responseFormat?: "json_object";
  temperature?: number;
  maxTokens?: number;
  search?: LiveSearchOptions;
};

export type GrokChatResult = {
  text: string;
  /** Raw upstream usage block. Field names are xAI's, not normalised. */
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    /** xAI also reports `num_sources_used` when Live Search is on. */
    num_sources_used?: number;
  };
  /** Citations the model used (URL strings). xAI returns these inline. */
  citations: string[];
};

export class GrokError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly upstream?: unknown,
  ) {
    super(message);
    this.name = "GrokError";
  }
}

export async function grokChatCompletion(
  req: GrokChatRequest,
): Promise<GrokChatResult> {
  const apiKey =
    process.env.AI_INTEGRATIONS_XAI_API_KEY ??
    process.env.GROK_API_KEY ??
    process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new GrokError("xAI / Grok API key is missing", 500);
  }

  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature,
    max_tokens: req.maxTokens,
  };
  if (req.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }
  if (req.search) {
    body.search_parameters = {
      mode: req.search.mode,
      sources: req.search.sources,
      max_search_results: req.search.maxSearchResults,
    };
  }

  const res = await fetch(`${DEFAULT_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      ((data?.error as { message?: string })?.message as string) ??
      `Grok HTTP ${res.status}`;
    throw new GrokError(msg, res.status, data);
  }

  const choice = (data?.choices as { message?: { content?: string } }[])?.[0];
  const text = choice?.message?.content ?? "";
  const usage =
    (data?.usage as GrokChatResult["usage"] | undefined) ?? {};
  // xAI puts citations either in `citations` (top-level) or
  // `choices[0].citations` depending on API version. Try both.
  const citations =
    (data?.citations as string[] | undefined) ??
    ((data?.choices as { citations?: string[] }[])?.[0]?.citations) ??
    [];

  return { text, usage, citations };
}
