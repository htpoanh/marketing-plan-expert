import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseAdsCsv,
  selectTopAndBottom,
  CsvParseError,
} from "./csv-parser";

const FIXTURE_DIR = join(__dirname, "__tests__/fixtures");
const meta = readFileSync(join(FIXTURE_DIR, "meta-export-sample.csv"), "utf8");
const google = readFileSync(join(FIXTURE_DIR, "google-ads-sample.csv"), "utf8");
const malformed = readFileSync(
  join(FIXTURE_DIR, "malformed-sample.csv"),
  "utf8",
);

describe("parseAdsCsv — Meta export", () => {
  const parsed = parseAdsCsv(meta);

  it("detects platform = meta", () => {
    expect(parsed.platform).toBe("meta");
    expect(parsed.detection.metaSignals.length).toBeGreaterThan(
      parsed.detection.googleSignals.length,
    );
  });

  it("extracts all 15 ad rows", () => {
    expect(parsed.rows.length).toBe(15);
  });

  it("normalises Meta CTR percentages to 0..1", () => {
    // Row 1 had "3.32%" → 0.0332
    expect(parsed.rows[0].ctr).toBeCloseTo(0.0332, 4);
  });

  it("computes per-row CPA from spend / conversions", () => {
    // Row 3 (PNK_Sommer_Awareness / AS_Berufstaetige_30km / Static_Promo20Off)
    // spend 234.50, results 4 → cpa = 58.625
    const row = parsed.rows.find(
      (r) => r.ad === "Static_Promo20Off",
    );
    expect(row).toBeDefined();
    expect(row!.cpaEur).toBeCloseTo(58.62, 1);
  });

  it("aggregates totals correctly", () => {
    const { stats } = parsed;
    expect(stats.rowCount).toBe(15);
    expect(stats.campaignCount).toBe(5); // 5 unique campaigns in fixture
    expect(stats.totalSpendEur).toBeGreaterThan(2000);
    expect(stats.totalSpendEur).toBeLessThan(3500);
    expect(stats.totalConversionValueEur).toBeNull(); // Meta has no conversion value
    expect(stats.blendedRoas).toBeNull();
  });

  it("does not crash on rows with 0 conversions (cpa = 0, not Infinity)", () => {
    for (const r of parsed.rows) {
      expect(Number.isFinite(r.cpaEur)).toBe(true);
    }
  });
});

describe("parseAdsCsv — Google Ads export", () => {
  const parsed = parseAdsCsv(google);

  it("detects platform = google", () => {
    expect(parsed.platform).toBe("google");
  });

  it("extracts ad groups + status field", () => {
    expect(parsed.rows.length).toBe(13);
    expect(parsed.rows[0].status).toBe("Enabled");
  });

  it("computes ROAS = conversion value / spend", () => {
    // Row 1: cost 28.40, conv value 720.00 → roas ≈ 25.35
    expect(parsed.rows[0].roas).toBeCloseTo(25.35, 1);
  });

  it("aggregates conversion value (Google has it)", () => {
    expect(parsed.stats.totalConversionValueEur).not.toBeNull();
    expect(parsed.stats.totalConversionValueEur!).toBeGreaterThan(15000);
    expect(parsed.stats.blendedRoas).not.toBeNull();
  });
});

describe("parseAdsCsv — error paths", () => {
  it("rejects empty input", () => {
    expect(() => parseAdsCsv("")).toThrow(CsvParseError);
    expect(() => parseAdsCsv("   \n  ")).toThrow(CsvParseError);
  });

  it("rejects CSV with no data rows", () => {
    expect(() => parseAdsCsv("just,a,header\n")).toThrow(CsvParseError);
  });

  it("rejects malformed CSV that can't be classified", () => {
    expect(() => parseAdsCsv(malformed)).toThrow(/Could not detect ad platform/);
  });

  it("rejects Meta-looking CSV missing required columns", () => {
    const bad = "Campaign name,Reach\nFoo,100\n";
    expect(() => parseAdsCsv(bad)).toThrow(/missing required/);
  });
});

describe("parseAdsCsv — locale + edge cases", () => {
  it("handles BOM prefix", () => {
    const withBom = "﻿" + meta;
    const parsed = parseAdsCsv(withBom);
    expect(parsed.platform).toBe("meta");
    expect(parsed.rows.length).toBe(15);
  });

  it("handles CRLF line endings", () => {
    const crlf = meta.replace(/\n/g, "\r\n");
    const parsed = parseAdsCsv(crlf);
    expect(parsed.rows.length).toBe(15);
  });

  it("handles German decimal format (comma) in numbers", () => {
    const csv = `Campaign,Ad group,Cost,Impressions,Clicks
Test,Group1,"1.234,56",10000,500
Test,Group2,"234,50",5000,200`;
    const parsed = parseAdsCsv(csv);
    expect(parsed.rows[0].spendEur).toBeCloseTo(1234.56, 2);
    expect(parsed.rows[1].spendEur).toBeCloseTo(234.5, 2);
  });

  it("handles US decimal format (dot)", () => {
    const csv = `Campaign,Ad group,Cost,Impressions,Clicks
Test,Group1,"1234.56",10000,500`;
    const parsed = parseAdsCsv(csv);
    expect(parsed.rows[0].spendEur).toBeCloseTo(1234.56, 2);
  });

  it("handles US thousands separator (comma)", () => {
    const csv = `Campaign,Ad group,Cost,Impressions,Clicks
Test,Group1,"1,234.56",10000,500`;
    const parsed = parseAdsCsv(csv);
    expect(parsed.rows[0].spendEur).toBeCloseTo(1234.56, 2);
  });
});

describe("selectTopAndBottom", () => {
  const parsed = parseAdsCsv(meta);

  it("returns top + bottom by spend", () => {
    const { top, bottom } = selectTopAndBottom(parsed.rows, "spendEur", 3);
    expect(top.length).toBe(3);
    expect(bottom.length).toBe(3);
    // Top spender should be > bottom spender
    expect(top[0].spendEur).toBeGreaterThan(bottom[0].spendEur);
  });

  it("filters out rows where metric is null (ROAS on Meta)", () => {
    const { top } = selectTopAndBottom(parsed.rows, "roas", 3);
    expect(top.length).toBe(0); // No Meta row has ROAS
  });

  it("returns rows correctly when count > total", () => {
    const { top, bottom } = selectTopAndBottom(parsed.rows, "cpaEur", 100);
    expect(top.length).toBe(parsed.rows.length);
    expect(bottom.length).toBe(parsed.rows.length);
  });
});
