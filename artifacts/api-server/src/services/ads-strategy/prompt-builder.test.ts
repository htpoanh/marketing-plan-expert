import { describe, it, expect } from "vitest";
import {
  buildBrandContextSection,
  outputLanguageLabel,
} from "./prompt-builder";
import { buildAudienceUserPrompt } from "./prompts/audience.prompt";
import { buildKeywordsUserPrompt } from "./prompts/keywords.prompt";
import type { Brand } from "@workspace/db/schema";

const minimalBrand: Brand = {
  id: 1,
  brandName: "Paradise Nails Kempten",
  industry: "Nails & Beauty",
  branchLocation: "Kempten (Allgäu)",
  address: "Kotterner Str. 70",
  phone: null,
  businessHours: null,
  aiProfileId: null,
  targetAudience: "Phụ nữ 18+ làm móng làm đẹp",
  brandVoice: "Sang trọng",
  websiteUrl: "https://paradise-nail-studio.de",
  facebookUrl: null,
  instagramUrl: null,
  tiktokUrl: null,
  googlePlaceId: null,
  adsContext: null,
  serviceRadiusKm: 30,
  avgTicketSizeEur: "45.00",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("buildBrandContextSection", () => {
  it("renders brand without ads_context using (not provided) placeholders", () => {
    const out = buildBrandContextSection(minimalBrand);
    expect(out).toContain("Paradise Nails Kempten");
    expect(out).toContain("Kempten (Allgäu)");
    expect(out).toContain("30 km");
    expect(out).toContain("€45.00");
    expect(out).toContain("(not provided)"); // for missing USPs/competitors
    expect(out).toMatch(/=== END BRAND CONTEXT ===$/);
  });

  it("includes ads_context fields when present", () => {
    const rich: Brand = {
      ...minimalBrand,
      adsContext: {
        uniqueSellingPoints: ["Express service", "Trending designs"],
        pricePositioning: "premium",
        competitors: [
          { name: "Nail Lounge", url: "https://x.de", notes: "premium" },
        ],
        primaryRegions: ["Kempten", "Allgäu"],
      },
    };
    const out = buildBrandContextSection(rich);
    expect(out).toContain("Express service");
    expect(out).toContain("premium");
    expect(out).toContain("Nail Lounge");
    expect(out).toContain("Kempten, Allgäu");
  });
});

describe("buildAudienceUserPrompt", () => {
  it("substitutes service + goal + budget + language", () => {
    const out = buildAudienceUserPrompt(
      {
        service: "Gel-Nägel Sommer 2026",
        campaignGoal: "awareness",
        budgetEur: 300,
        outputLanguage: "de",
      },
      minimalBrand,
    );
    expect(out).toContain("Gel-Nägel Sommer 2026");
    expect(out).toContain("awareness");
    expect(out).toContain("€300");
    expect(out).toContain("German");
    // Schema must be inline so the model has clear instructions
    expect(out).toContain('"personas"');
    expect(out).toContain('"metaTargeting"');
    expect(out).toContain('"budgetSplit"');
  });

  it("renders no-budget case as '(not specified)'", () => {
    const out = buildAudienceUserPrompt(
      {
        service: "X",
        campaignGoal: "leads",
        budgetEur: null,
        outputLanguage: "vi",
      },
      minimalBrand,
    );
    expect(out).toContain("(not specified)");
    expect(out).toContain("Vietnamese");
  });
});

describe("buildKeywordsUserPrompt", () => {
  it("renders provided competitors list", () => {
    const out = buildKeywordsUserPrompt(
      {
        service: "Gel-Nails",
        competitors: ["Nail Lounge", "Beauty Studio"],
        outputLanguage: "de",
      },
      minimalBrand,
    );
    expect(out).toContain("Nail Lounge, Beauty Studio");
    expect(out).toContain("moneyKeywords");
    expect(out).toContain("verificationChecklist");
  });

  it("falls back to '(none)' when no competitors provided", () => {
    const out = buildKeywordsUserPrompt(
      { service: "X", competitors: [], outputLanguage: "de" },
      minimalBrand,
    );
    expect(out).toContain("(none)");
  });
});

describe("outputLanguageLabel", () => {
  it.each([
    ["de", "German"],
    ["vi", "Vietnamese"],
    ["en", "English"],
  ] as const)("maps %s → %s", (input, label) => {
    expect(outputLanguageLabel(input)).toBe(label);
  });
});
