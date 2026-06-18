import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  decimal,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { brandsTable } from "./brands";

/**
 * Phase D — Trend Intelligence Engine.
 *
 * Scored, persisted trends. TREND SCORE =
 *   trendStrength × relevance × strategyAlignment ÷ productionDifficulty
 * (each factor 1-10). Bucket: >50 propose now, 30-50 backlog, <30 skip.
 */

export const TREND_INSIGHT_STATUSES = [
  "new",
  "proposed",
  "backlog",
  "skipped",
  "actioned",
] as const;
export type TrendInsightStatus = (typeof TREND_INSIGHT_STATUSES)[number];

/** The 4 scoring factors + the cross-check verdict against Strategy Inbox. */
export type TrendFactors = {
  trendStrength: number; // 1-10
  relevance: number; // 1-10
  strategyAlignment: number; // 1-10
  productionDifficulty: number; // 1-10
};

export const trendInsightsTable = pgTable(
  "trend_insights",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandsTable.id, {
      onDelete: "cascade",
    }),
    trendName: text("trend_name").notNull(),
    description: text("description"),
    source: text("source"), // grok | google_trends | reddit | tiktok | news | maps
    trendScore: decimal("trend_score", { precision: 6, scale: 1 }).notNull(),
    factors: jsonb("factors").$type<TrendFactors>(),
    momentum: text("momentum"), // rising | peak | declining
    estimatedWindowDays: integer("estimated_window_days"),
    suggestedAngle: text("suggested_angle"),
    suggestedKeywords: jsonb("suggested_keywords").$type<string[]>(),
    /** Verdict vs Strategy Inbox: align | conflict | neutral + note. */
    strategyAlignmentNote: text("strategy_alignment_note"),
    recommendedAction: text("recommended_action"),
    status: text("status").$type<TrendInsightStatus>().notNull().default("new"),
    weekNumber: integer("week_number"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    brandStatusIdx: index("idx_trend_insights_brand_status").on(
      table.brandId,
      table.status,
    ),
    scoreIdx: index("idx_trend_insights_score").on(table.trendScore),
    statusCheck: check(
      "trend_insights_status_check",
      sql`${table.status} IN ('new', 'proposed', 'backlog', 'skipped', 'actioned')`,
    ),
  }),
);

export type TrendInsight = typeof trendInsightsTable.$inferSelect;
export type InsertTrendInsight = typeof trendInsightsTable.$inferInsert;
