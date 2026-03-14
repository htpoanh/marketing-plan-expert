import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiProfilesTable } from "./ai_profiles";

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
