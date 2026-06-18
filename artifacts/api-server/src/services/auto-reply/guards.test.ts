import { describe, it, expect } from "vitest";
import {
  checkOutgoingReply,
  isDailyCapReached,
  isTooNegativeToAutoSend,
} from "./guards";

describe("checkOutgoingReply", () => {
  it("blocks replies promising a refund", () => {
    expect(checkOutgoingReply("Sie bekommen eine Erstattung.").ok).toBe(false);
    expect(checkOutgoingReply("Das Geld zurück, kein Problem.").ok).toBe(false);
  });

  it("blocks replies promising discounts / vouchers / freebies", () => {
    expect(checkOutgoingReply("Hier ist ein Rabatt von 10%.").ok).toBe(false);
    expect(checkOutgoingReply("Wir schicken Ihnen einen Gutschein.").ok).toBe(false);
    expect(checkOutgoingReply("Der nächste Kaffee geht auf uns.").ok).toBe(false);
  });

  it("allows a clean, on-brand reply", () => {
    const r = checkOutgoingReply("Vielen Dank für Ihr Feedback! Wir freuen uns auf Ihren Besuch.");
    expect(r.ok).toBe(true);
  });
});

describe("isDailyCapReached", () => {
  it("is reached at or above the cap", () => {
    expect(isDailyCapReached(50, 50)).toBe(true);
    expect(isDailyCapReached(51, 50)).toBe(true);
  });
  it("is not reached below the cap", () => {
    expect(isDailyCapReached(49, 50)).toBe(false);
    expect(isDailyCapReached(0, 50)).toBe(false);
  });
});

describe("isTooNegativeToAutoSend", () => {
  it("blocks clearly negative sentiment", () => {
    expect(isTooNegativeToAutoSend(-0.8)).toBe(true);
    expect(isTooNegativeToAutoSend(-0.3)).toBe(true);
  });
  it("allows neutral/positive sentiment", () => {
    expect(isTooNegativeToAutoSend(0)).toBe(false);
    expect(isTooNegativeToAutoSend(0.85)).toBe(false);
  });
});
