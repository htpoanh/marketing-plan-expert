import { describe, it, expect } from "vitest";
import {
  formatDigestMessage,
  selectBrandsForDigest,
} from "./weekly-trend-digest";
import type { Brand } from "@workspace/db/schema";

const fixedDate = new Date("2026-05-04T08:00:00Z");

function brand(id: number, name: string, primaryRegions?: string[]): Brand {
  return {
    id,
    brandName: name,
    industry: "Beauty",
    branchLocation: "Kempten",
    address: null,
    phone: null,
    businessHours: null,
    aiProfileId: null,
    targetAudience: "x",
    brandVoice: "y",
    websiteUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    tiktokUrl: null,
    googlePlaceId: null,
    adsContext: primaryRegions ? { primaryRegions } : null,
    serviceRadiusKm: null,
    avgTicketSizeEur: null,
    createdAt: fixedDate,
    updatedAt: fixedDate,
  };
}

describe("selectBrandsForDigest", () => {
  it("returns only brands with primaryRegions when no allowlist", () => {
    const all = [
      brand(1, "Has Region", ["Bayern"]),
      brand(2, "No Region"),
      brand(3, "Empty Region", []),
      brand(4, "Allgäu", ["Allgäu", "Kempten"]),
    ];
    const out = selectBrandsForDigest(all, null);
    expect(out.map((b) => b.id)).toEqual([1, 4]);
  });

  it("respects explicit brandIds allowlist regardless of primaryRegions", () => {
    const all = [
      brand(1, "Has Region", ["Bayern"]),
      brand(2, "No Region"),
      brand(3, "Allgäu", ["Allgäu"]),
    ];
    const out = selectBrandsForDigest(all, { brandIds: [2] });
    // Brand 2 has no primaryRegions but is in the allowlist — should be picked
    expect(out.map((b) => b.id)).toEqual([2]);
  });

  it("returns empty when allowlist matches nothing", () => {
    const all = [brand(1, "X", ["Bayern"])];
    expect(selectBrandsForDigest(all, { brandIds: [999] })).toHaveLength(0);
  });
});

describe("formatDigestMessage", () => {
  const date = new Date("2026-05-04T08:00:00Z");

  it("renders header + per-brand sections + total cost", () => {
    const out = formatDigestMessage(
      [
        {
          brandId: 1,
          brandName: "Paradise Nails Kempten",
          region: "Bayern",
          ok: true,
          trendCount: 5,
          topTrends: [
            {
              topic: "Glazed Donut Nails",
              relevanceScore: 9,
              momentum: "rising",
              suggestedAngle: "Reel Before/After",
            },
            {
              topic: "Spring Pastels",
              relevanceScore: 7,
              momentum: "peak",
              suggestedAngle: "Carousel mit Farbpalette",
            },
          ],
          costEur: "0.0250",
        },
        {
          brandId: 2,
          brandName: "Happy Wok",
          region: "Allgäu",
          ok: true,
          trendCount: 3,
          topTrends: [
            {
              topic: "Asian Fusion Lunch",
              relevanceScore: 8,
              momentum: "rising",
              suggestedAngle: "Story mit Mittagsangebot",
            },
          ],
          costEur: "0.0220",
        },
      ],
      date,
    );
    expect(out).toContain("Weekly Trend Digest");
    expect(out).toContain("Paradise Nails Kempten");
    expect(out).toContain("Happy Wok");
    expect(out).toContain("Glazed Donut Nails");
    expect(out).toContain("9/10");
    expect(out).toContain("Reel Before/After");
    // Total cost = 0.025 + 0.022 = 0.047 → formatted as €0.0470
    expect(out).toContain("€0.0470");
    // Brands processed
    expect(out).toContain("*2*");
  });

  it("renders rising/peak/declining icons distinctly", () => {
    const out = formatDigestMessage(
      [
        {
          brandId: 1,
          brandName: "X",
          region: "DE",
          ok: true,
          topTrends: [
            { topic: "A", relevanceScore: 9, momentum: "rising", suggestedAngle: "x" },
            { topic: "B", relevanceScore: 8, momentum: "peak", suggestedAngle: "y" },
            { topic: "C", relevanceScore: 7, momentum: "declining", suggestedAngle: "z" },
          ],
          costEur: "0.025",
        },
      ],
      date,
    );
    expect(out).toContain("📈"); // rising
    expect(out).toContain("🔥"); // peak
    expect(out).toContain("📉"); // declining
  });

  it("includes failure section when some brands errored", () => {
    const out = formatDigestMessage(
      [
        {
          brandId: 1,
          brandName: "OK Brand",
          region: "Bayern",
          ok: true,
          topTrends: [
            { topic: "T", relevanceScore: 9, momentum: "rising", suggestedAngle: "a" },
          ],
          costEur: "0.025",
        },
        {
          brandId: 2,
          brandName: "Broken Brand",
          region: "Allgäu",
          ok: false,
          error: "Grok HTTP 429",
        },
      ],
      date,
    );
    expect(out).toContain("Brands processed: *1*");
    expect(out).toContain("(failed: 1)");
    expect(out).toContain("Failures");
    expect(out).toContain("Broken Brand");
    expect(out).toContain("Grok HTTP 429");
  });

  it("shows fallback message when no brand returned successfully", () => {
    const out = formatDigestMessage(
      [
        { brandId: 1, brandName: "A", region: "DE", ok: false, error: "x" },
        { brandId: 2, brandName: "B", region: "DE", ok: false, error: "y" },
      ],
      date,
    );
    expect(out).toContain("No brand returned trends");
  });
});
