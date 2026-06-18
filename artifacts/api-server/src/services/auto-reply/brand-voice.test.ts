import { describe, it, expect } from "vitest";
import { resolveBrandVoice, withSignOff } from "./brand-voice";

describe("resolveBrandVoice", () => {
  it("matches Paradise Nails locations by substring", () => {
    expect(resolveBrandVoice({ brandName: "Paradise Nails Kempten" }).signOff).toBe(
      "Ihr Paradise Nails Team",
    );
  });

  it("matches Happy Wok", () => {
    expect(resolveBrandVoice({ brandName: "Happy Wok Memmingen" }).signOff).toBe(
      "Euer Happy Wok Team",
    );
  });

  it("matches Asia Supermarkt to the Thai Hoang sign-off", () => {
    expect(resolveBrandVoice({ brandName: "Asia Supermarkt Allgäu" }).signOff).toBe(
      "Ihr Thai Hoang Team",
    );
  });

  it("matches Coco/Halong nail studios", () => {
    expect(resolveBrandVoice({ brandName: "Coco Nails" }).signOff).toBe("Euer Coco Nails Team");
    expect(resolveBrandVoice({ brandName: "Halong Nails" }).signOff).toBe("Euer Coco Nails Team");
  });

  it("prefers the brandVoice column as the tone hint when present", () => {
    const v = resolveBrandVoice({ brandName: "Paradise Nails", brandVoice: "ultra-luxuriös" });
    expect(v.tone).toBe("ultra-luxuriös");
    expect(v.signOff).toBe("Ihr Paradise Nails Team");
  });

  it("falls back to a generic sign-off for unknown brands", () => {
    expect(resolveBrandVoice({ brandName: "Mystery Brand" }).signOff).toBe("Ihr Mystery Brand Team");
  });
});

describe("withSignOff", () => {
  it("appends the sign-off when missing", () => {
    expect(withSignOff("Danke!", "Euer Happy Wok Team")).toBe("Danke!\n\nEuer Happy Wok Team");
  });
  it("does not duplicate an existing sign-off", () => {
    const reply = "Danke!\n\nEuer Happy Wok Team";
    expect(withSignOff(reply, "Euer Happy Wok Team")).toBe(reply);
  });
});
