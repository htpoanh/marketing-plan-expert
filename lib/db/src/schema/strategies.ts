import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const strategiesTable = pgTable("strategies", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "cascade" }).notNull(),
  platform: text("platform").notNull(),
  campaignGoal: text("campaign_goal").notNull(),
  duration: text("duration"),
  storeSituation: text("store_situation"),
  marketingModel: text("marketing_model"),
  reasoning: text("reasoning"),
  campaignAngle: text("campaign_angle"),
  funnelStage: text("funnel_stage"),
  targetEmotion: text("target_emotion"),
  ctaStrategy: text("cta_strategy"),
  suggestedTopics: jsonb("suggested_topics").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Strategy = typeof strategiesTable.$inferSelect;
export type InsertStrategy = typeof strategiesTable.$inferInsert;
