import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Phase H — Virtual KOL System.
 *
 * 3 AI characters (Thái An, Pearl, Felix) post on behalf of brand groups.
 * kol_characters holds the persona + fixed voice/visual seed; kol_posts holds
 * generated content; kol_interactions logs replies to followers. EU AI Act
 * (02/08/2026) disclosure is enforced in the caption by the service.
 */
export const kolCharactersTable = pgTable("kol_characters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull(),
  /** Brand ids this character speaks for. */
  brandIds: jsonb("brand_ids").$type<number[]>().default([]),
  personality: text("personality"),
  /** ElevenLabs voice id (resolved from env at generation time). */
  voiceId: text("voice_id"),
  /** OpenAI image seed for face consistency. */
  visualSeed: text("visual_seed"),
  language: text("language").default("de"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type KolCharacter = typeof kolCharactersTable.$inferSelect;
export type InsertKolCharacter = typeof kolCharactersTable.$inferInsert;

export const kolPostsTable = pgTable(
  "kol_posts",
  {
    id: serial("id").primaryKey(),
    characterId: integer("character_id")
      .references(() => kolCharactersTable.id, { onDelete: "cascade" })
      .notNull(),
    contentPlanId: integer("content_plan_id"),
    script: text("script"),
    caption: text("caption"),
    hashtags: jsonb("hashtags").$type<string[]>().default([]),
    imageUrl: text("image_url"),
    audioUrl: text("audio_url"),
    videoUrl: text("video_url"),
    metricoolPostId: text("metricool_post_id"),
    status: text("status").default("draft").notNull(),
    performance: jsonb("performance").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    characterIdx: index("idx_kol_posts_character").on(table.characterId),
  }),
);

export type KolPost = typeof kolPostsTable.$inferSelect;
export type InsertKolPost = typeof kolPostsTable.$inferInsert;

export const kolInteractionsTable = pgTable("kol_interactions", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id")
    .references(() => kolCharactersTable.id, { onDelete: "cascade" })
    .notNull(),
  platform: text("platform"),
  externalCommentId: text("external_comment_id"),
  incomingMessage: text("incoming_message"),
  generatedReply: text("generated_reply"),
  sent: boolean("sent").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type KolInteraction = typeof kolInteractionsTable.$inferSelect;
export type InsertKolInteraction = typeof kolInteractionsTable.$inferInsert;
