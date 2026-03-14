import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "cascade" }),
  customerPsid: text("customer_psid").notNull(),
  customerName: text("customer_name"),
  service: text("service"),
  preferredDate: text("preferred_date"),
  preferredTime: text("preferred_time"),
  phone: text("phone"),
  notes: text("notes"),
  status: text("status").default("pending").notNull(),
  managerNotifiedAt: timestamp("manager_notified_at"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Appointment = typeof appointmentsTable.$inferSelect;
export type InsertAppointment = typeof appointmentsTable.$inferInsert;
