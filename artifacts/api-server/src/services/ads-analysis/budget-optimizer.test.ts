import { describe, it, expect } from "vitest";
import { suggestReallocation, crossPlatformSummary } from "./budget-optimizer";

describe("suggestReallocation", () => {
  it("returns null with fewer than 2 scored platforms", () => {
    expect(suggestReallocation([{ platform: "facebook", spendEur: 100, roas: 2 }])).toBeNull();
  });

  it("shifts from a zero-ROAS platform to the best", () => {
    const s = suggestReallocation([
      { platform: "facebook", spendEur: 100, roas: 3 },
      { platform: "tiktok", spendEur: 100, roas: 0 },
    ]);
    expect(s).not.toBeNull();
    expect(s!.fromPlatform).toBe("tiktok");
    expect(s!.toPlatform).toBe("facebook");
    expect(s!.shiftEur).toBe(30);
  });

  it("does nothing when ROAS gap is small", () => {
    expect(
      suggestReallocation([
        { platform: "facebook", spendEur: 100, roas: 2.0 },
        { platform: "tiktok", spendEur: 100, roas: 1.8 },
      ]),
    ).toBeNull();
  });

  it("shifts when best ROAS >= 1.5x worst", () => {
    const s = suggestReallocation([
      { platform: "google", spendEur: 200, roas: 4 },
      { platform: "tiktok", spendEur: 100, roas: 2 },
    ]);
    expect(s!.fromPlatform).toBe("tiktok");
    expect(s!.toPlatform).toBe("google");
  });
});

describe("crossPlatformSummary", () => {
  it("computes spend-weighted blended ROAS", () => {
    const r = crossPlatformSummary([
      { platform: "facebook", spendEur: 100, roas: 4 },
      { platform: "tiktok", spendEur: 100, roas: 2 },
    ]);
    expect(r.totalSpendEur).toBe(200);
    expect(r.blendedRoas).toBe(3);
    expect(r.bestPlatform).toBe("facebook");
    expect(r.worstPlatform).toBe("tiktok");
  });

  it("handles no ROAS data", () => {
    const r = crossPlatformSummary([{ platform: "facebook", spendEur: 50, roas: null }]);
    expect(r.blendedRoas).toBeNull();
    expect(r.totalSpendEur).toBe(50);
  });
});
