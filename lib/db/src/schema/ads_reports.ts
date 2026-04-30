import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  decimal,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { brandsTable } from "./brands";

/**
 * Ads Strategy Agent — module identifier
 * - audience    M1: Personas + Meta/Google targeting
 * - keyword     M2: Weighted keyword groups
 * - performance M3: CSV ads analysis + budget reallocation
 * - trend       M4: Real-time trend pulse (Grok)
 */
export const ADS_MODULES = [
  "audience",
  "keyword",
  "performance",
  "trend",
] as const;
export type AdsModule = (typeof ADS_MODULES)[number];

/**
 * AI provider enum (kept as plain string to allow future providers without
 * blocking migrations).
 */
export type AdsAiProvider = "anthropic" | "google" | "openai" | "xai";

export const adsReportsTable = pgTable(
  "ads_reports",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .references(() => brandsTable.id, { onDelete: "cascade" })
      .notNull(),
    module: text("module").$type<AdsModule>().notNull(),
    /** Raw input the user submitted (form values, brand snapshot). */
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    /** AI-generated, schema-validated output. Shape depends on `module`. */
    output: jsonb("output").$type<Record<string, unknown>>().notNull(),
    aiProvider: text("ai_provider").$type<AdsAiProvider>().notNull(),
    aiModel: text("ai_model").notNull(),
    tokensInput: integer("tokens_input"),
    tokensOutput: integer("tokens_output"),
    costEur: decimal("cost_eur", { precision: 10, scale: 4 }),
    latencyMs: integer("latency_ms"),
    /** Free-form notes Phuong Oanh writes about this report after running. */
    userNotes: text("user_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    brandModuleIdx: index("idx_ads_reports_brand_module").on(
      table.brandId,
      table.module,
    ),
    createdAtIdx: index("idx_ads_reports_created_at").on(table.createdAt),
    moduleCheck: check(
      "ads_reports_module_check",
      sql`${table.module} IN ('audience', 'keyword', 'performance', 'trend')`,
    ),
    providerCheck: check(
      "ads_reports_provider_check",
      sql`${table.aiProvider} IN ('anthropic', 'google', 'openai', 'xai')`,
    ),
  }),
);

export type AdsReport = typeof adsReportsTable.$inferSelect;
export type InsertAdsReport = typeof adsReportsTable.$inferInsert;
