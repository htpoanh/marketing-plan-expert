import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { brandsTable } from "./brands";

export const contentPlansTable = pgTable("content_plans", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "cascade" }).notNull(),
  publishDate: timestamp("publish_date").notNull(),
  platform: text("platform").notNull(),
  contentType: text("content_type").notNull(),
  topic: text("topic").notNull(),
  hook: text("hook"),
  caption: text("caption"),
  shortCaption: text("short_caption"),
  cta: text("cta"),
  hashtags: text("hashtags"),
  imagePrompt: text("image_prompt"),
  videoPrompt: text("video_prompt"),
  imageUrl: text("image_url"),
  promptRating: text("prompt_rating"), // 'good' | 'bad' | null — dữ liệu training AI
  status: text("status").default("draft").notNull(),
  rejectReason: text("reject_reason"),
  metricoolJobId: text("metricool_job_id"),
  // ── Phase F — Content Pipeline (additive) ──────────────────────────────────
  aiReasoning: text("ai_reasoning"),
  trendSource: text("trend_source"),
  strategyInboxId: integer("strategy_inbox_id"),
  videoUrl: text("video_url"),
  metricoolPostId: text("metricool_post_id"),
  scheduledDate: timestamp("scheduled_date"),
  weekNumber: integer("week_number"),
  kolCharacterId: integer("kol_character_id"),
  adsSuitable: boolean("ads_suitable").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertContentPlanSchema = createInsertSchema(contentPlansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContentPlan = z.infer<typeof insertContentPlanSchema>;
export type ContentPlan = typeof contentPlansTable.$inferSelect;
