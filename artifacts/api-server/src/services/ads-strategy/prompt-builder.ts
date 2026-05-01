/**
 * Shared prompt-building utilities — turns a Brand row + ads_context JSON
 * into the BRAND CONTEXT section that every Ads Strategy module prompt
 * starts with.
 *
 * Stays defensive: any missing field in ads_context is rendered as a "(not
 * provided)" placeholder rather than crashing — Phase 1 seed brands have
 * sparse adsContext, and we don't want the prompt to break before Phase 4
 * brand-context UI lands.
 */
import type { Brand } from "@workspace/db/schema";

export type PromptOutputLanguage = "de" | "vi" | "en";

const NA = "(not provided)";

function bullets(items: readonly string[] | undefined | null): string {
  if (!items || items.length === 0) return `  ${NA}`;
  return items.map((s) => `  - ${s}`).join("\n");
}

/**
 * Build the BRAND CONTEXT section. Combines top-level brand fields with the
 * `adsContext` JSONB column. Output is a Markdown-ish block ready to be
 * dropped into any provider's user prompt.
 */
export function buildBrandContextSection(brand: Brand): string {
  const ctx = brand.adsContext ?? {};
  const usps = ctx.uniqueSellingPoints ?? [];
  const competitors = ctx.competitors ?? [];
  const regions = ctx.primaryRegions ?? [];
  const excluded = ctx.excludedRegions ?? [];
  const languages = ctx.primaryLanguages ?? ["de"];

  return `=== BRAND CONTEXT ===
Name: ${brand.brandName}
Industry: ${brand.industry}
Branch / location: ${brand.branchLocation}
Address: ${brand.address ?? NA}
Service radius: ${brand.serviceRadiusKm ?? NA} km
Average ticket: ${
    brand.avgTicketSizeEur ? `€${brand.avgTicketSizeEur}` : NA
  }
Price positioning: ${ctx.pricePositioning ?? NA}
Booking URL: ${ctx.bookingUrl ?? brand.websiteUrl ?? NA}

Target audience (owner-described):
  ${brand.targetAudience}

Brand voice (owner-described):
  ${brand.brandVoice}

Unique selling points:
${bullets(usps)}

Direct competitors:
${
  competitors.length > 0
    ? competitors
        .map(
          (c) =>
            `  - ${c.name}${c.url ? ` (${c.url})` : ""}${c.notes ? ` — ${c.notes}` : ""}`,
        )
        .join("\n")
    : `  ${NA}`
}

Primary regions: ${regions.length > 0 ? regions.join(", ") : NA}
Excluded regions: ${excluded.length > 0 ? excluded.join(", ") : "(none)"}
Primary languages: ${languages.join(", ")}

Social channels:
  - Website: ${brand.websiteUrl ?? NA}
  - Facebook: ${brand.facebookUrl ?? NA}
  - Instagram: ${brand.instagramUrl ?? NA}
  - TikTok: ${brand.tiktokUrl ?? NA}

Owner's extra notes: ${ctx.notes ?? NA}
=== END BRAND CONTEXT ===`;
}

/**
 * Maps the user-facing OutputLanguage enum to a human label used inside
 * prompts ("German" / "Vietnamese" / "English"). Helps the model stay in
 * the right language for explanations / notes.
 */
export function outputLanguageLabel(lang: PromptOutputLanguage): string {
  switch (lang) {
    case "de":
      return "German";
    case "vi":
      return "Vietnamese";
    case "en":
      return "English";
  }
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
