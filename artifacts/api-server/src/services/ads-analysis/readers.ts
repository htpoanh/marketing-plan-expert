/**
 * Phase A — ad-platform readers (env-gated scaffolds).
 *
 * Each reader lazily checks for its credentials at call time (never throws at
 * import, so the server boots fine without keys). When keys are absent it
 * returns { active:false, reason } so the UI shows exactly what's waiting on
 * credentials. When keys are present, the TODO marks where the live API call
 * goes — the shape returned is already the normalized one we persist.
 */
import type { AdsPlatform, InsertAdsPerformanceRow } from "@workspace/db/schema";

export type ReaderResult =
  | { active: true; row: Omit<InsertAdsPerformanceRow, "id" | "createdAt"> }
  | { active: false; platform: AdsPlatform; reason: string };

function missing(platform: AdsPlatform, envVars: string[]): ReaderResult {
  return {
    active: false,
    platform,
    reason: `Nicht aktiv — fehlende Env-Variablen: ${envVars.join(", ")}`,
  };
}

export async function readFacebookAds(brandId: number, weekStart: string): Promise<ReaderResult> {
  const token = process.env.FACEBOOK_ADS_ACCESS_TOKEN;
  const account = process.env.FACEBOOK_ADS_ACCOUNT_ID;
  if (!token || !account) return missing("facebook", ["FACEBOOK_ADS_ACCESS_TOKEN", "FACEBOOK_ADS_ACCOUNT_ID"]);
  // TODO(keys): GET https://graph.facebook.com/v19.0/act_{account}/insights
  //   ?level=campaign&fields=spend,reach,impressions,clicks,ctr,cpm,cpc,actions
  //   &time_range={since,until}. Normalize → row below.
  void brandId; void weekStart;
  throw new Error("facebook ads reader: live pull not yet wired (keys present)");
}

export async function readTiktokAds(brandId: number, weekStart: string): Promise<ReaderResult> {
  const token = process.env.TIKTOK_ADS_ACCESS_TOKEN;
  const advertiser = process.env.TIKTOK_ADVERTISER_ID;
  if (!token || !advertiser) return missing("tiktok", ["TIKTOK_ADS_ACCESS_TOKEN", "TIKTOK_ADVERTISER_ID"]);
  // TODO(keys): POST https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/
  //   with metrics [spend, reach, impressions, clicks, ctr, cpc, video_play_actions, ...].
  void brandId; void weekStart;
  throw new Error("tiktok ads reader: live pull not yet wired (keys present)");
}

export async function readGoogleAds(brandId: number, weekStart: string): Promise<ReaderResult> {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customer = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const refresh = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!devToken || !customer || !refresh) {
    return missing("google", [
      "GOOGLE_ADS_DEVELOPER_TOKEN",
      "GOOGLE_ADS_CUSTOMER_ID",
      "GOOGLE_ADS_REFRESH_TOKEN",
    ]);
  }
  // TODO(keys): Google Ads API searchStream with a GAQL query over
  //   campaign + metrics (cost_micros, impressions, clicks, ctr, conversions).
  void brandId; void weekStart;
  throw new Error("google ads reader: live pull not yet wired (keys present)");
}

export const READERS: Record<AdsPlatform, (b: number, w: string) => Promise<ReaderResult>> = {
  facebook: readFacebookAds,
  tiktok: readTiktokAds,
  google: readGoogleAds,
};
