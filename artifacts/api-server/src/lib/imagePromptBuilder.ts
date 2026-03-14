type BrandInfo = {
  brandName: string;
  industry: string | null;
  branchLocation?: string | null;
  brandVoice?: string | null;
};

function isNailSalon(industry: string | null | undefined): boolean {
  if (!industry) return false;
  const lower = industry.toLowerCase();
  return lower.includes("nail") || lower.includes("beauty") || lower.includes("salon") || lower.includes("nails");
}

function isFnB(industry: string | null | undefined): boolean {
  if (!industry) return false;
  const lower = industry.toLowerCase();
  return (
    lower.includes("f&b") ||
    lower.includes("food") ||
    lower.includes("restaurant") ||
    lower.includes("wok") ||
    lower.includes("asia") ||
    lower.includes("cuisine") ||
    lower.includes("cafe") ||
    lower.includes("bistro") ||
    lower.includes("essen")
  );
}

export function buildImagePromptGuidance(brand: BrandInfo, topic: string): string {
  const location = brand.branchLocation ?? "Germany";
  const voice = brand.brandVoice ?? "elegant and professional";

  if (isNailSalon(brand.industry)) {
    return `Generate an imagePrompt following this exact cinematic structure for a nail salon marketing photo:

"Ultra realistic close-up photo of a woman's hand with professionally done gel nails in a nail salon.

Nail style: [choose one relevant to topic: '${topic}'] — realistic thickness, clean cuticles, natural nail bed color. Select from:
- Classic French manicure
- Nude gel with white tips
- Pastel spring/seasonal colors
- Glitter gel with gold flakes
- Minimalist luxury nail art lines
- Subtle rhinestone accents
- Soft ombre or baby boomer gradient

Nail shapes: almond, square, coffin or short stiletto.

Lighting: soft beauty lighting like in a professional nail salon, warm indoor light, natural skin texture, slight shine on gel polish.

Background: soft white fluffy salon cushion embroidered with '${brand.brandName}' logo, shallow depth of field, blurred salon interior.

Camera style: macro beauty photography, 50mm lens, high detail skin texture, salon portfolio photography.

Composition: hand resting naturally on cushion, fingers slightly relaxed, focus on nail design, realistic proportions.

Quality: extremely detailed, photorealistic, natural colors, professional nail studio photography, 4K.

Avoid: overly perfect plastic skin, unrealistic nail length, fantasy nails, cartoon style, AI artifacts, extra fingers."

Adapt the nail design and color palette to match the post topic: "${topic}". Keep all text in English.`;
  }

  if (isFnB(brand.industry)) {
    return `Generate an imagePrompt following this exact cinematic structure for an Asian restaurant marketing photo:

"Ultra realistic food photography of [dish relevant to topic: '${topic}'] at ${brand.brandName}, ${location}.

Food style: authentic Asian home-cooked style — generous portions, fresh ingredients, vibrant colors, steam rising naturally, chopsticks or appropriate utensils beside the dish.

Possible dishes to match topic:
- Steaming bowl of Asian noodle soup with rich broth
- Colorful stir-fry in a wok with vegetables and protein
- Rice dish with various toppings and garnishes
- Dim sum or appetizer spread on bamboo steamer
- Fresh spring rolls with dipping sauce

Lighting: warm restaurant lighting, slight golden hour glow, soft bokeh, light reflecting off sauce or broth, dramatic food lighting with gentle shadows.

Background: clean wooden table or dark slate surface, subtle restaurant interior, branded chopstick wrapper or takeaway box with '${brand.brandName}' logo visible.

Camera style: food photography with 50mm or 85mm macro lens, top-down or 45-degree angle shot, DSLR quality, editorial food style.

Composition: hero dish centered, garnishes scattered naturally, slight steam or condensation, appetizing and realistic proportions.

Quality: extremely detailed, photorealistic, vibrant appetizing colors, professional food studio photography, 4K.

Avoid: plastic-looking food, CGI food, unrealistic portions, cartoon style, AI artifacts, empty tables."

Adapt the dish and presentation to match the post topic: "${topic}". Keep all text in English.`;
  }

  return `Generate an imagePrompt following this cinematic structure:

"Ultra realistic professional marketing photo for ${brand.brandName} — ${brand.industry ?? "local business"} in ${location}.

Subject: [choose the most relevant visual for topic: '${topic}']

Style: ${voice}, authentic, real-life scene, no stock photo feel.

Lighting: soft professional lighting, warm tones, natural shadows.

Background: clean, brand-appropriate environment with subtle brand elements.

Camera style: professional DSLR, shallow depth of field, 50mm lens, editorial quality.

Composition: subject centered or rule-of-thirds, authentic and inviting, brand colors visible.

Quality: extremely detailed, photorealistic, professional commercial photography, 4K.

Avoid: cartoon style, AI artifacts, generic stock imagery, text overlays in image."

Adapt to match the post topic: "${topic}". Keep all text in English.`;
}
