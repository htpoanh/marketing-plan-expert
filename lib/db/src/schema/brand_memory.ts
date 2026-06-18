import {
  pgTable,
  serial,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

/**
 * Phase I — Learning Memory.
 *
 * One evolving row per brand (unique). The weekly rebuild job aggregates the
 * signals we have today (customer intents from the reply queue, top scored
 * trends) and leaves the performance-derived fields (formats, save/completion
 * rates) ready to be filled once Phase A (ads) / Phase F (post performance)
 * land. Consumed by the weekly report + future content prompts.
 */

export type BrandMemoryFacts = {
  topFormats: Array<{ format: string; score: number }>;
  topTopics: Array<{ topic: string; score: number }>;
  bestHours: number[];
  provenHashtags: string[];
  topIntentKeywords: Array<{ intent: string; count: number }>;
  trendAlignments: Array<{ trend: string; score: number }>;
  notes: string[];
};

export const brandMemoryTable = pgTable("brand_memory", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id")
    .references(() => brandsTable.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  version: integer("version").notNull().default(1),
  topFormats: jsonb("top_formats").$type<BrandMemoryFacts["topFormats"]>().default([]),
  topTopics: jsonb("top_topics").$type<BrandMemoryFacts["topTopics"]>().default([]),
  bestHours: jsonb("best_hours").$type<number[]>().default([]),
  provenHashtags: jsonb("proven_hashtags").$type<string[]>().default([]),
  topIntentKeywords: jsonb("top_intent_keywords")
    .$type<BrandMemoryFacts["topIntentKeywords"]>()
    .default([]),
  trendAlignments: jsonb("trend_alignments")
    .$type<BrandMemoryFacts["trendAlignments"]>()
    .default([]),
  audienceIca: jsonb("audience_ica").$type<Record<string, unknown>>(),
  adsPerformanceHistory: jsonb("ads_performance_history").$type<unknown[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BrandMemory = typeof brandMemoryTable.$inferSelect;
export type InsertBrandMemory = typeof brandMemoryTable.$inferInsert;
