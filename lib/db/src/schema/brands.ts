import { pgTable, text, serial, timestamp, integer, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiProfilesTable } from "./ai_profiles";

/**
 * BrandAdsContext — extra brand metadata used to ground Ads Strategy Agent
 * (M1 Audience, M2 Keywords, M3 Performance, M4 Trend Pulse) prompts.
 *
 * Stored as JSONB to keep schema flexible while we iterate on what fields
 * the prompts actually need. See docs/DATA_SCHEMAS.md §1.2.
 */
export type BrandAdsContext = {
  uniqueSellingPoints?: string[];
  competitors?: { name: string; url?: string; notes?: string }[];
  pricePositioning?: "budget" | "mid" | "premium" | "luxury";
  bookingUrl?: string;
  metaPixelId?: string;
  googleAdsCustomerId?: string;
  primaryRegions?: string[];        // e.g. ["Kempten", "Allgäu"]
  excludedRegions?: string[];
  primaryLanguages?: string[];      // e.g. ["de", "vi"]
  notes?: string;
};

export const brandsTable = pgTable("brands", {
  id: serial("id").primaryKey(),
  brandName: text("brand_name").notNull(),
  industry: text("industry").notNull(),
  branchLocation: text("branch_location").notNull(),
  address: text("address"),
  phone: text("phone"),
  businessHours: text("business_hours"),
  aiProfileId: integer("ai_profile_id").references(() => aiProfilesTable.id),
  targetAudience: text("target_audience").notNull(),
  brandVoice: text("brand_voice").notNull(),
  websiteUrl: text("website_url"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  tiktokUrl: text("tiktok_url"),
  googlePlaceId: text("google_place_id"),
  // ── Ads Strategy Agent extensions (Phase 1, additive only) ────────────────
  adsContext: jsonb("ads_context").$type<BrandAdsContext>(),
  serviceRadiusKm: integer("service_radius_km"),
  avgTicketSizeEur: decimal("avg_ticket_size_eur", { precision: 10, scale: 2 }),
  // ──────────────────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBrandSchema = createInsertSchema(brandsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brandsTable.$inferSelect;
