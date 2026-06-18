import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  date,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { brandsTable } from "./brands";

/**
 * Phase B — Strategy Inbox.
 *
 * Phuong Oanh drops in campaign ideas, company goals, format experiments, or
 * post-service feedback at any time. Claude analyses each item (feasibility,
 * timeline, resources, risks, which week to slot it into) and the analysis is
 * persisted alongside the raw input so the weekly report can pull from it.
 *
 * brandId is NULLABLE: a null brand means the item applies to ALL brands.
 */

export const STRATEGY_INPUT_TYPES = [
  "campaign_idea",
  "company_goal",
  "format_test",
  "feedback",
  "other",
] as const;
export type StrategyInputType = (typeof STRATEGY_INPUT_TYPES)[number];

export const STRATEGY_PRIORITIES = ["high", "medium", "low"] as const;
export type StrategyPriority = (typeof STRATEGY_PRIORITIES)[number];

export const STRATEGY_STATUSES = [
  "pending", // submitted, awaiting / running analysis
  "analyzed", // Claude analysis attached
  "incorporated", // folded into a weekly plan
  "archived", // dismissed
] as const;
export type StrategyStatus = (typeof STRATEGY_STATUSES)[number];

/** Shape of the persisted Claude analysis blob. */
export type StrategyAnalysis = {
  summary: string;
  feasibility: { rating: "high" | "medium" | "low"; rationale: string };
  timeline: string;
  resources: string[];
  risks: string[];
  recommendedWeek: string;
  alignsWithTrends?: string | null;
};

export const strategyInboxTable = pgTable(
  "strategy_inbox",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id").references(() => brandsTable.id, {
      onDelete: "cascade",
    }),
    inputType: text("input_type").$type<StrategyInputType>().notNull(),
    content: text("content").notNull(),
    priority: text("priority").$type<StrategyPriority>().notNull().default("medium"),
    deadline: date("deadline"),
    claudeAnalysis: jsonb("claude_analysis").$type<StrategyAnalysis>(),
    status: text("status").$type<StrategyStatus>().notNull().default("pending"),
    incorporatedInWeek: integer("incorporated_in_week"),
    tokensInput: integer("tokens_input"),
    tokensOutput: integer("tokens_output"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    brandStatusIdx: index("idx_strategy_inbox_brand_status").on(
      table.brandId,
      table.status,
    ),
    createdAtIdx: index("idx_strategy_inbox_created_at").on(table.createdAt),
    inputTypeCheck: check(
      "strategy_inbox_input_type_check",
      sql`${table.inputType} IN ('campaign_idea', 'company_goal', 'format_test', 'feedback', 'other')`,
    ),
    priorityCheck: check(
      "strategy_inbox_priority_check",
      sql`${table.priority} IN ('high', 'medium', 'low')`,
    ),
    statusCheck: check(
      "strategy_inbox_status_check",
      sql`${table.status} IN ('pending', 'analyzed', 'incorporated', 'archived')`,
    ),
  }),
);

export type StrategyInboxItem = typeof strategyInboxTable.$inferSelect;
export type InsertStrategyInboxItem = typeof strategyInboxTable.$inferInsert;
