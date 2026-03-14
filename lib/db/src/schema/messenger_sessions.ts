import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const messengerSessionsTable = pgTable("messenger_sessions", {
  id: serial("id").primaryKey(),
  psid: text("psid").notNull().unique(),
  brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "cascade" }),
  state: text("state").default("idle").notNull(),
  collectedData: jsonb("collected_data"),
  appointmentId: integer("appointment_id"),
  conversationHistory: jsonb("conversation_history"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MessengerSession = typeof messengerSessionsTable.$inferSelect;
export type InsertMessengerSession = typeof messengerSessionsTable.$inferInsert;
