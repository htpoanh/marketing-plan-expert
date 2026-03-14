import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiProfilesTable = pgTable("ai_profiles", {
  id: serial("id").primaryKey(),
  profileName: text("profile_name").notNull(),
  industry: text("industry"),
  description: text("description"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAiProfileSchema = createInsertSchema(aiProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiProfile = z.infer<typeof insertAiProfileSchema>;
export type AiProfile = typeof aiProfilesTable.$inferSelect;
