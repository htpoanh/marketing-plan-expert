import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

/**
 * Phase C — Market Research crawler output.
 *
 * One row per signal collected from a source. Sources:
 *   news (Google News RSS, free) · maps (Places API, existing key) ·
 *   trends (Google Trends) · reddit · tiktok · grok (M4).
 * Free sources run today; key-gated sources persist a row noting they're
 * inactive until the relevant API key is configured.
 */
export const marketIntelligenceTable = pgTable(
  "market_intelligence",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandsTable.id, {
      onDelete: "cascade",
    }),
    weekNumber: integer("week_number"),
    source: text("source").notNull(), // news | maps | trends | reddit | tiktok | grok
    category: text("category"), // event | competitor | trend | painpoint | opportunity | inactive
    title: text("title").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>(),
    relevanceScore: integer("relevance_score"), // 0-100
    urgency: text("urgency"), // low | medium | high
    incorporated: boolean("incorporated").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    brandSourceIdx: index("idx_market_intel_brand_source").on(
      table.brandId,
      table.source,
    ),
    createdAtIdx: index("idx_market_intel_created_at").on(table.createdAt),
  }),
);

export type MarketIntelligence = typeof marketIntelligenceTable.$inferSelect;
export type InsertMarketIntelligence =
  typeof marketIntelligenceTable.$inferInsert;
