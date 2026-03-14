import { pgTable, text, serial, timestamp, boolean, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiProfilesTable } from "./ai_profiles";

export const aiAgentConfigsTable = pgTable("ai_agent_configs", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => aiProfilesTable.id).notNull(),
  agentKey: text("agent_key").notNull(),
  agentName: text("agent_name").notNull(),
  aiModel: text("ai_model").notNull(),
  defaultRole: text("default_role").notNull(),
  expertiseArea: text("expertise_area"),
  customInstructions: text("custom_instructions"),
  outputStyle: text("output_style"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  profileAgentUnique: unique().on(table.profileId, table.agentKey),
}));

export const insertAiAgentConfigSchema = createInsertSchema(aiAgentConfigsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiAgentConfig = z.infer<typeof insertAiAgentConfigSchema>;
export type AiAgentConfig = typeof aiAgentConfigsTable.$inferSelect;
