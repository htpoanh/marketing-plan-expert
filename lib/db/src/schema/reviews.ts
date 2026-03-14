import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { brandsTable } from "./brands";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "cascade" }).notNull(),
  reviewerName: text("reviewer_name").notNull(),
  rating: integer("rating").notNull(),
  reviewText: text("review_text"),
  reviewDate: timestamp("review_date").notNull(),
  replied: boolean("replied").default(false).notNull(),
  replyText: text("reply_text"),
  replyDate: timestamp("reply_date"),
  googleReviewId: text("google_review_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
