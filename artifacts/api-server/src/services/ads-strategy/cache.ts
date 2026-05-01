/**
 * Deterministic-input cache for Ads Strategy AI calls.
 *
 * The contract: if a user requests the same audience / keywords for the
 * same brand within the cache window, return the previously-generated
 * report instead of spending tokens to regenerate.
 *
 * Hash key includes:
 *   - brandId
 *   - brand.updatedAt (so editing the brand invalidates its cache)
 *   - the form input (service, goal, language, etc.)
 *   - prompt version (so iterating prompt templates invalidates cache)
 *
 * The hash is stored in `ads_reports.input.meta.cacheKey` so we can look
 * it up via a JSONB path query.
 *
 * Cache window default: 7 days. Past that we regenerate so the output
 * benefits from any model improvements / brand changes.
 */
import { createHash } from "crypto";
import { db } from "@workspace/db";
import {
  adsReportsTable,
  type AdsModule,
  type AdsReport,
} from "@workspace/db/schema";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import type { Brand } from "@workspace/db/schema";

const DEFAULT_TTL_DAYS = 7;

export type CacheKeyInput = {
  brandId: number;
  brand: Pick<Brand, "id" | "updatedAt">;
  module: AdsModule;
  promptVersion: string;
  /** The user-submitted form input (omit fields that shouldn't affect cache). */
  formInput: Record<string, unknown>;
};

/**
 * Build a stable SHA256 hash of `formInput` + brand version + module +
 * prompt version. Returns the first 32 hex chars — collision space of 2^128
 * is fine for our scale.
 */
export function buildCacheKey(input: CacheKeyInput): string {
  // Sort keys for deterministic stringification
  const sortedFormInput = sortKeys(input.formInput);
  const payload = JSON.stringify({
    b: input.brandId,
    bV: input.brand.updatedAt instanceof Date
      ? input.brand.updatedAt.toISOString()
      : String(input.brand.updatedAt),
    m: input.module,
    pV: input.promptVersion,
    f: sortedFormInput,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj as Record<string, unknown>).sort()) {
      out[k] = sortKeys((obj as Record<string, unknown>)[k]);
    }
    return out;
  }
  return obj;
}

/**
 * Look up a cached report. Returns null if no hit within TTL.
 *
 * The lookup uses a JSONB path query: WHERE input->'meta'->>'cacheKey' = ...
 * This is fast on small tables; if ads_reports grows past ~100k rows we
 * should add an expression index on `(input->'meta'->>'cacheKey')`.
 */
export async function findCachedReport(
  brandId: number,
  module: AdsModule,
  cacheKey: string,
  ttlDays = DEFAULT_TTL_DAYS,
): Promise<AdsReport | null> {
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);
  const [hit] = await db
    .select()
    .from(adsReportsTable)
    .where(
      and(
        eq(adsReportsTable.brandId, brandId),
        eq(adsReportsTable.module, module),
        gte(adsReportsTable.createdAt, cutoff),
        sql`${adsReportsTable.input}->'meta'->>'cacheKey' = ${cacheKey}`,
      ),
    )
    .orderBy(desc(adsReportsTable.createdAt))
    .limit(1);

  return hit ?? null;
}

/** Exposed so tests + diagnostics can see the default TTL. */
export const CACHE_TTL_DAYS = DEFAULT_TTL_DAYS;
