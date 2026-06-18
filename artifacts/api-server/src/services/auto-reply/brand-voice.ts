/**
 * Phase G — Brand voice + German sign-off resolution.
 *
 * v3.0 spec assigns each of the 6 Thai Hoang GmbH brand families a tone and a
 * fixed German sign-off. The brand table actually holds 11 rows (5 Paradise
 * locations, 2 nail studios, etc.) so we match by case-insensitive substring
 * on brandName and fall back to a generic sign-off + the brand's own
 * brandVoice column when nothing matches.
 */

export type BrandVoiceProfile = {
  /** Short tone descriptor injected into the AI system prompt. */
  tone: string;
  /** Fixed German closing line appended to every reply for this brand. */
  signOff: string;
};

type BrandVoiceRule = {
  /** Lower-cased substrings — any match wins. Order = priority. */
  match: string[];
  profile: BrandVoiceProfile;
};

const BRAND_VOICE_RULES: BrandVoiceRule[] = [
  {
    match: ["paradise"],
    profile: { tone: "warm, professionell, gehoben (Luxus-Nagelstudio)", signOff: "Ihr Paradise Nails Team" },
  },
  {
    match: ["coco", "halong"],
    profile: { tone: "warm, feminin, fürsorglich", signOff: "Euer Coco Nails Team" },
  },
  {
    match: ["happy wok"],
    profile: { tone: "freundlich, schnell, appetitanregend", signOff: "Euer Happy Wok Team" },
  },
  {
    match: ["taki"],
    profile: { tone: "kultiviert, elegant, aufmerksam", signOff: "Ihr Taki Taki Team" },
  },
  {
    match: ["asia supermarkt", "supermarkt", "asia markt"],
    profile: { tone: "hilfsbereit, gemeinschaftsorientiert", signOff: "Ihr Thai Hoang Team" },
  },
  {
    match: ["hafencafé", "hafencafe", "café", "cafe"],
    profile: { tone: "entspannt, einladend, lifestyle-orientiert", signOff: "Euer Hafencafé Team" },
  },
];

/**
 * Resolve the voice profile for a brand. `brandVoice` (the DB column) is used
 * as a richer tone hint when present; otherwise the matched rule's tone is used.
 */
export function resolveBrandVoice(brand: {
  brandName?: string | null;
  brandVoice?: string | null;
}): BrandVoiceProfile {
  const name = (brand.brandName ?? "").toLowerCase();
  const matched = BRAND_VOICE_RULES.find((rule) =>
    rule.match.some((needle) => name.includes(needle)),
  );

  if (matched) {
    return {
      tone: brand.brandVoice?.trim() ? brand.brandVoice.trim() : matched.profile.tone,
      signOff: matched.profile.signOff,
    };
  }

  return {
    tone: brand.brandVoice?.trim() || "freundlich, professionell und authentisch",
    signOff: brand.brandName ? `Ihr ${brand.brandName} Team` : "Ihr Team",
  };
}

/** Append the sign-off if the reply doesn't already end with it. */
export function withSignOff(reply: string, signOff: string): string {
  const trimmed = reply.trim();
  if (trimmed.toLowerCase().includes(signOff.toLowerCase())) return trimmed;
  return `${trimmed}\n\n${signOff}`;
}
