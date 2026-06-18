/**
 * Phase F — Metricool draft push (env-gated stub).
 *
 * When METRICOOL_API_TOKEN + the brand's METRICOOL_BLOG_ID_* are set, pushes a
 * DRAFT post (autoPublish:false) so the user reviews it on the Metricool
 * calendar. Without keys it returns { active:false } so the pipeline still
 * produces the draft locally.
 */
const BLOG_ENV_BY_BRAND: Record<string, string> = {
  paradise: "METRICOOL_BLOG_ID_PARADISE_NAILS",
  coco: "METRICOOL_BLOG_ID_COCO_NAILS",
  "happy wok": "METRICOOL_BLOG_ID_HAPPY_WOK",
  "asia supermarkt": "METRICOOL_BLOG_ID_ASIA_SUPERMARKT",
  taki: "METRICOOL_BLOG_ID_TAKI_TAKI",
  "hafencafé": "METRICOOL_BLOG_ID_HAFENCAFE",
  "hafencafe": "METRICOOL_BLOG_ID_HAFENCAFE",
};

function resolveBlogEnv(brandName: string): string | undefined {
  const name = (brandName ?? "").toLowerCase();
  const key = Object.keys(BLOG_ENV_BY_BRAND).find((k) => name.includes(k));
  return key ? BLOG_ENV_BY_BRAND[key] : undefined;
}

export type MetricoolResult =
  | { active: true; postId: string }
  | { active: false; reason: string };

export async function pushMetricoolDraft(params: {
  brandName: string;
  text: string;
  scheduledIso: string;
}): Promise<MetricoolResult> {
  const token = process.env.METRICOOL_API_TOKEN;
  const userId = process.env.METRICOOL_USER_ID;
  const blogEnv = resolveBlogEnv(params.brandName);
  const blogId = blogEnv ? process.env[blogEnv] : undefined;

  if (!token || !userId || !blogId) {
    const missing = [
      !token && "METRICOOL_API_TOKEN",
      !userId && "METRICOOL_USER_ID",
      !blogId && (blogEnv ?? "METRICOOL_BLOG_ID_*"),
    ].filter(Boolean);
    return { active: false, reason: `Metricool inaktiv — fehlt: ${missing.join(", ")}` };
  }

  // TODO(keys): POST https://app.metricool.com/api/v2/scheduler/posts
  //   { autoPublish:false, publicationDate:{dateTime,timezone:"Europe/Berlin"}, text, blogId }
  //   headers: X-Mc-Auth: token. Returns the created post id.
  throw new Error("metricool push: live call not yet wired (keys present)");
}
