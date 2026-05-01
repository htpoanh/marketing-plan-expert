import { describe, it, expect } from "vitest";
import { buildCacheKey } from "./cache";

const baseBrand = {
  id: 42,
  updatedAt: new Date("2026-04-30T12:00:00Z"),
};

describe("buildCacheKey", () => {
  it("produces a 32-char hex string", () => {
    const key = buildCacheKey({
      brandId: 42,
      brand: baseBrand,
      module: "audience",
      promptVersion: "1.0.0",
      formInput: { service: "Gel-Nails", goal: "awareness" },
    });
    expect(key).toMatch(/^[a-f0-9]{32}$/);
  });

  it("returns the same key for identical inputs", () => {
    const a = buildCacheKey({
      brandId: 1,
      brand: { id: 1, updatedAt: new Date("2026-01-01") },
      module: "audience",
      promptVersion: "1.0.0",
      formInput: { service: "X", goal: "leads" },
    });
    const b = buildCacheKey({
      brandId: 1,
      brand: { id: 1, updatedAt: new Date("2026-01-01") },
      module: "audience",
      promptVersion: "1.0.0",
      formInput: { service: "X", goal: "leads" },
    });
    expect(a).toBe(b);
  });

  it("ignores property order in formInput", () => {
    const a = buildCacheKey({
      brandId: 1,
      brand: baseBrand,
      module: "keyword",
      promptVersion: "1.0.0",
      formInput: { service: "X", competitors: ["A"], outputLanguage: "de" },
    });
    const b = buildCacheKey({
      brandId: 1,
      brand: baseBrand,
      module: "keyword",
      promptVersion: "1.0.0",
      formInput: { outputLanguage: "de", service: "X", competitors: ["A"] },
    });
    expect(a).toBe(b);
  });

  it("changes when service changes", () => {
    const a = buildCacheKey({
      brandId: 1,
      brand: baseBrand,
      module: "audience",
      promptVersion: "1.0.0",
      formInput: { service: "Gel-Nails" },
    });
    const b = buildCacheKey({
      brandId: 1,
      brand: baseBrand,
      module: "audience",
      promptVersion: "1.0.0",
      formInput: { service: "Acryl-Nails" },
    });
    expect(a).not.toBe(b);
  });

  it("changes when brand.updatedAt changes (brand edits invalidate cache)", () => {
    const a = buildCacheKey({
      brandId: 1,
      brand: { id: 1, updatedAt: new Date("2026-01-01") },
      module: "audience",
      promptVersion: "1.0.0",
      formInput: { service: "X" },
    });
    const b = buildCacheKey({
      brandId: 1,
      brand: { id: 1, updatedAt: new Date("2026-02-01") }, // brand was edited
      module: "audience",
      promptVersion: "1.0.0",
      formInput: { service: "X" },
    });
    expect(a).not.toBe(b);
  });

  it("changes when promptVersion is bumped (regenerate after prompt iteration)", () => {
    const a = buildCacheKey({
      brandId: 1,
      brand: baseBrand,
      module: "audience",
      promptVersion: "1.0.0",
      formInput: { service: "X" },
    });
    const b = buildCacheKey({
      brandId: 1,
      brand: baseBrand,
      module: "audience",
      promptVersion: "1.1.0",
      formInput: { service: "X" },
    });
    expect(a).not.toBe(b);
  });

  it("changes when module changes (audience vs keyword)", () => {
    const a = buildCacheKey({
      brandId: 1,
      brand: baseBrand,
      module: "audience",
      promptVersion: "1.0.0",
      formInput: { service: "X" },
    });
    const b = buildCacheKey({
      brandId: 1,
      brand: baseBrand,
      module: "keyword",
      promptVersion: "1.0.0",
      formInput: { service: "X" },
    });
    expect(a).not.toBe(b);
  });
});
