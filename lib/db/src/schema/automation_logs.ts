import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const automationLogsTable = pgTable("automation_logs", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull(),
  brandName: text("brand_name").notNull(),
  runAt: timestamp("run_at").defaultNow().notNull(),
  status: text("status").notNull().default("success"),
  plansCreated: integer("plans_created").notNull().default(0),
  webhookSent: boolean("webhook_sent").notNull().default(false),
  webhookStatus: text("webhook_status"),
  webhookError: text("webhook_error"),
  errorMessage: text("error_message"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AutomationLog = typeof automationLogsTable.$inferSelect;
export type InsertAutomationLog = typeof automationLogsTable.$inferInsert;
