import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const messengerConfigsTable = pgTable("messenger_configs", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "cascade" }).notNull().unique(),
  pageAccessToken: text("page_access_token"),
  verifyToken: text("verify_token"),
  managerPsid: text("manager_psid"),
  pageId: text("page_id"),
  isActive: boolean("is_active").default(false).notNull(),
  welcomeMessage: text("welcome_message"),
  businessHoursInfo: text("business_hours_info"),
  servicesInfo: text("services_info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MessengerConfig = typeof messengerConfigsTable.$inferSelect;
export type InsertMessengerConfig = typeof messengerConfigsTable.$inferInsert;
