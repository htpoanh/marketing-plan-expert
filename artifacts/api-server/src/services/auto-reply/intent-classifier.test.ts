import { describe, it, expect } from "vitest";
import { classifyIntentByKeywords } from "./intent-classifier";

describe("classifyIntentByKeywords", () => {
  it("returns 'other' with zero confidence for empty input", () => {
    const r = classifyIntentByKeywords("");
    expect(r.intent).toBe("other");
    expect(r.confidence).toBe(0);
  });

  it("detects booking intent", () => {
    expect(classifyIntentByKeywords("Kann ich einen Termin buchen?").intent).toBe("booking");
    expect(classifyIntentByKeywords("Wann haben Sie frei?").intent).toBe("booking");
  });

  it("detects price intent", () => {
    expect(classifyIntentByKeywords("Was kostet Gel-Nägel?").intent).toBe("price");
    expect(classifyIntentByKeywords("Wie viel kostet das?").intent).toBe("price");
  });

  it("detects compliment intent with positive sentiment", () => {
    const r = classifyIntentByKeywords("Einfach super, ich empfehle euch weiter!");
    expect(r.intent).toBe("compliment");
    expect(r.sentiment).toBeGreaterThan(0);
  });

  it("detects complaint intent with negative sentiment", () => {
    const r = classifyIntentByKeywords("Sehr schlecht, ich bin enttäuscht, nie wieder!");
    expect(r.intent).toBe("complaint");
    expect(r.sentiment).toBeLessThan(0);
  });

  it("prioritises complaint over compliment when both present (safety)", () => {
    // "super" (compliment) + "enttäuscht" (complaint) — complaint must win
    const r = classifyIntentByKeywords("Der Service war super, aber dann war ich enttäuscht.");
    expect(r.intent).toBe("complaint");
  });

  it("falls back to 'other' for neutral text", () => {
    expect(classifyIntentByKeywords("Hallo zusammen").intent).toBe("other");
  });

  it("scales confidence with number of matched terms", () => {
    const one = classifyIntentByKeywords("termin");
    const many = classifyIntentByKeywords("termin buchen wann frei");
    expect(many.confidence).toBeGreaterThan(one.confidence);
  });
});
