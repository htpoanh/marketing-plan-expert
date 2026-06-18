/**
 * Phase F — Brand DNA visual prompts (pure).
 *
 * The fixed visual identity each brand's image prompt must follow (from v3.0).
 * Matched by brand-name substring, with a neutral fallback.
 */
export type BrandDna = {
  /** Visual style instruction injected into the image prompt. */
  visual: string;
  /** Hex palette to keep generations on-brand. */
  palette: string[];
};

type DnaRule = { match: string[]; dna: BrandDna };

const RULES: DnaRule[] = [
  {
    match: ["paradise"],
    dna: { visual: "flat lay, fingertips ONLY (no full hands), elegant nail design, soft studio light", palette: ["#2C1A0E", "#B87333"] },
  },
  {
    match: ["coco", "halong"],
    dna: { visual: "flat lay with rose petals + fingertips, feminine, soft pastel, dreamy", palette: ["#E8A0BF"] },
  },
  {
    match: ["happy wok"],
    dna: { visual: "overhead shot of wok/food, visible steam, vibrant, appetizing", palette: ["#D4340A"] },
  },
  {
    match: ["asia supermarkt", "supermarkt", "asia markt"],
    dna: { visual: "bright product flat lay, clean, fresh, well-lit grocery aesthetic", palette: ["#2D6A4F"] },
  },
  {
    match: ["taki"],
    dna: { visual: "dark moody plating, fine-dining, dramatic side light, elegant", palette: ["#000000", "#C9A84C"] },
  },
  {
    match: ["hafencafé", "hafencafe", "café", "cafe"],
    dna: { visual: "Bodensee lake view with coffee in frame, lifestyle, relaxed, golden hour", palette: ["#1B6CA8", "#C9A84C"] },
  },
];

export function resolveBrandDna(brandName: string): BrandDna {
  const name = (brandName ?? "").toLowerCase();
  const matched = RULES.find((r) => r.match.some((n) => name.includes(n)));
  return (
    matched?.dna ?? {
      visual: "clean, professional, on-brand product photography",
      palette: [],
    }
  );
}
