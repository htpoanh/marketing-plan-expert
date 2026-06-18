import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  decimal,
  boolean,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

/**
 * Phase A — Ads Performance Reader.
 *
 * ads_performance: one row per brand × platform × week pulled from the ad
 * platforms (Facebook/Meta, TikTok, Google). Today the readers are env-gated
 * scaffolds — rows can also be entered manually / via the scan once keys land.
 *
 * ads_proposals: budget-reallocation suggestions the optimizer produces from
 * the performance rows, surfaced for approval in the weekly report.
 */
export const ADS_PLATFORMS = ["facebook", "tiktok", "google"] as const;
export type AdsPlatform = (typeof ADS_PLATFORMS)[number];

export const adsPerformanceTable = pgTable(
  "ads_performance",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .references(() => brandsTable.id, { onDelete: "cascade" })
      .notNull(),
    platform: text("platform").$type<AdsPlatform>().notNull(),
    weekStart: date("week_start"),
    spendEur: decimal("spend_eur", { precision: 10, scale: 2 }),
    reach: integer("reach"),
    impressions: integer("impressions"),
    clicks: integer("clicks"),
    ctr: decimal("ctr", { precision: 5, scale: 4 }),
    cpm: decimal("cpm", { precision: 10, scale: 2 }),
    cpc: decimal("cpc", { precision: 10, scale: 2 }),
    roas: decimal("roas", { precision: 10, scale: 2 }),
    topCreativeId: text("top_creative_id"),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    brandPlatformIdx: index("idx_ads_perf_brand_platform").on(
      table.brandId,
      table.platform,
    ),
    weekIdx: index("idx_ads_perf_week").on(table.weekStart),
  }),
);

export type AdsPerformanceRow = typeof adsPerformanceTable.$inferSelect;
export type InsertAdsPerformanceRow = typeof adsPerformanceTable.$inferInsert;

export const adsProposalsTable = pgTable("ads_proposals", {
  id: serial("id").primaryKey(),
  weeklyReportId: integer("weekly_report_id"),
  brandId: integer("brand_id")
    .references(() => brandsTable.id, { onDelete: "cascade" })
    .notNull(),
  platform: text("platform").$type<AdsPlatform>().notNull(),
  campaignType: text("campaign_type"),
  budgetEur: decimal("budget_eur", { precision: 10, scale: 2 }),
  budgetChangeReason: text("budget_change_reason"),
  targeting: jsonb("targeting").$type<Record<string, unknown>>(),
  creativePostId: integer("creative_post_id"),
  expectedReach: integer("expected_reach"),
  status: text("status").default("proposed").notNull(),
  userNotes: text("user_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdsProposal = typeof adsProposalsTable.$inferSelect;
export type InsertAdsProposal = typeof adsProposalsTable.$inferInsert;
