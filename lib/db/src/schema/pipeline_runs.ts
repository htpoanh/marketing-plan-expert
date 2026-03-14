import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const pipelineRunsTable = pgTable("pipeline_runs", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "cascade" }).notNull(),
  topic: text("topic").notNull(),
  goal: text("goal").notNull(),
  platform: text("platform").notNull(),
  contentCount: integer("content_count").default(1).notNull(),
  storeSituation: text("store_situation"),
  status: text("status").default("running").notNull(),
  trendData: jsonb("trend_data"),
  strategyData: jsonb("strategy_data"),
  contentData: jsonb("content_data"),
  promptData: jsonb("prompt_data"),
  savedPlanIds: jsonb("saved_plan_ids").$type<number[]>().default([]),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PipelineRun = typeof pipelineRunsTable.$inferSelect;
export type InsertPipelineRun = typeof pipelineRunsTable.$inferInsert;
