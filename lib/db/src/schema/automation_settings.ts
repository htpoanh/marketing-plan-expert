import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const automationSettingsTable = pgTable("automation_settings", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "cascade" }).notNull().unique(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  platforms: text("platforms").default("Facebook,Instagram").notNull(),
  contentTypes: text("content_types").default("post,reel,story").notNull(),
  runHour: integer("run_hour").default(17).notNull(),
  autoApprove: boolean("auto_approve").default(false).notNull(),
  topicMode: text("topic_mode").default("auto").notNull(),
  customGoal: text("custom_goal"),
  metricoolAccountId: text("metricool_account_id"),
  metricoolToken: text("metricool_token"),
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: text("last_run_status"),
  lastRunSummary: text("last_run_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AutomationSettings = typeof automationSettingsTable.$inferSelect;
export type InsertAutomationSettings = typeof automationSettingsTable.$inferInsert;
