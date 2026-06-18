import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  boolean,
  timestamp,
  date,
  index,
} from "drizzle-orm/pg-core";

/**
 * Phase E — Weekly Meeting Dashboard.
 *
 * One row per generated weekly report. The generator assembles KPI data +
 * sections (reply stats, top trends, pending strategy items, market signals,
 * insight cards) deterministically from the other tables; the user reviews +
 * approves from /weekly-report.
 */

export type WeeklyKpi = {
  reviewsAutoReplied: number;
  reviewsEscalated: number;
  commentsHandled: number;
  trendsProposed: number;
  strategyItemsPending: number;
  marketSignals: number;
};

export type WeeklyInsight = {
  kind: "success" | "danger" | "info";
  title: string;
  detail: string;
};

export type WeeklySections = {
  replyStats: Record<string, unknown>;
  topTrends: Array<{ brandId: number | null; trendName: string; score: number }>;
  pendingStrategy: Array<{ id: number; brandId: number | null; content: string }>;
  marketSignals: Array<{ source: string; title: string }>;
  insights: WeeklyInsight[];
};

export const weeklyReportsTable = pgTable(
  "weekly_reports",
  {
    id: serial("id").primaryKey(),
    weekNumber: integer("week_number").notNull(),
    weekStart: date("week_start"),
    kpiData: jsonb("kpi_data").$type<WeeklyKpi>(),
    sections: jsonb("sections").$type<WeeklySections>(),
    trendAnalysis: text("trend_analysis"),
    chatLog: jsonb("chat_log").$type<unknown[]>().default([]),
    approvedByUser: boolean("approved_by_user").default(false).notNull(),
    autoApproved: boolean("auto_approved").default(false).notNull(),
    approvedAt: timestamp("approved_at"),
    telegramSent: boolean("telegram_sent").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    weekIdx: index("idx_weekly_reports_week").on(table.weekNumber),
    createdAtIdx: index("idx_weekly_reports_created_at").on(table.createdAt),
  }),
);

export type WeeklyReport = typeof weeklyReportsTable.$inferSelect;
export type InsertWeeklyReport = typeof weeklyReportsTable.$inferInsert;
