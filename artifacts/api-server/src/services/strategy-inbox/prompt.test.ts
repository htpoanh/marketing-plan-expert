import { describe, it, expect } from "vitest";
import { buildStrategyInboxUserPrompt } from "./prompt";
import type { Brand } from "@workspace/db/schema";

const brand = {
  id: 2,
  brandName: "Paradise Nails Kempten",
  industry: "Nagelstudio",
  branchLocation: "Kempten",
  targetAudience: "Frauen 25-45",
  brandVoice: "warm, professionell",
  adsContext: {},
} as unknown as Brand;

describe("buildStrategyInboxUserPrompt", () => {
  it("includes brand name when a brand is given", () => {
    const p = buildStrategyInboxUserPrompt(
      { inputType: "campaign_idea", content: "Sommer-Aktion testen", priority: "high" },
      brand,
    );
    expect(p).toContain("Paradise Nails Kempten");
    expect(p).toContain("Sommer-Aktion testen");
    expect(p).toContain("Kampagnen-Idee");
    expect(p).toContain("Priorität: high");
  });

  it("emits an all-brands note when brand is null", () => {
    const p = buildStrategyInboxUserPrompt(
      { inputType: "company_goal", content: "Mehr Stammkunden", priority: "medium" },
      null,
    );
    expect(p).toContain("ALLE Marken");
    expect(p).toContain("Mehr Stammkunden");
  });

  it("renders the deadline or a placeholder", () => {
    const withDeadline = buildStrategyInboxUserPrompt(
      { inputType: "other", content: "x", priority: "low", deadline: "2026-07-01" },
      null,
    );
    expect(withDeadline).toContain("2026-07-01");
    const without = buildStrategyInboxUserPrompt(
      { inputType: "other", content: "x", priority: "low" },
      null,
    );
    expect(without).toContain("(keine)");
  });

  it("requests JSON output in the chosen language", () => {
    const p = buildStrategyInboxUserPrompt(
      { inputType: "feedback", content: "x", priority: "low", outputLanguage: "vi" },
      null,
    );
    expect(p).toContain("Vietnamesisch");
    expect(p).toContain("recommendedWeek");
  });
});
