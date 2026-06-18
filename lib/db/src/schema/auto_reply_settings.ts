import {
  pgTable,
  serial,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

/**
 * Phase G — per-brand auto-reply configuration + safety guards.
 *
 * One row per brand (unique FK). Absence of a row means "all auto-reply
 * disabled" — the engine treats a missing row as fully off, so a brand
 * never gets auto-replies until the user explicitly opts in from /inbox.
 */
export const autoReplySettingsTable = pgTable("auto_reply_settings", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id")
    .references(() => brandsTable.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  /** Auto-reply to Google Business reviews (>= escalateThreshold+1 stars). */
  googleEnabled: boolean("google_enabled").default(false).notNull(),
  /** Auto-reply to Facebook page comments. */
  fbCommentsEnabled: boolean("fb_comments_enabled").default(false).notNull(),
  /** Auto-reply to Instagram comments. */
  igCommentsEnabled: boolean("ig_comments_enabled").default(false).notNull(),
  /**
   * Max auto-sent replies per brand per platform per day. Guard against
   * runaway loops / spam flags. Default 50 per v3.0 spec.
   */
  dailyCap: integer("daily_cap").default(50).notNull(),
  /**
   * Reviews with rating <= this value are NEVER auto-sent — they are queued +
   * escalated for human handling. Default 2 (so 1-2 stars escalate, 3-5 auto).
   */
  escalateThreshold: integer("escalate_threshold").default(2).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AutoReplySettings = typeof autoReplySettingsTable.$inferSelect;
export type InsertAutoReplySettings =
  typeof autoReplySettingsTable.$inferInsert;
