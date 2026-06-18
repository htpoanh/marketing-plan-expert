import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  decimal,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { brandsTable } from "./brands";

/**
 * Phase G — Auto-Reply Engine
 *
 * `reply_queue` is the unified inbox row for every inbound interaction the
 * engine touches across channels (Google reviews + FB/IG comments + Messenger).
 * Whether a reply was auto-sent, is awaiting manual review, or was escalated
 * to the human, there is exactly one row here so the /inbox UI and the stats
 * endpoint have a single source of truth.
 */

/** Channel the interaction came from. */
export const REPLY_PLATFORMS = [
  "google", // Google Business Profile review
  "facebook", // Facebook page comment
  "instagram", // Instagram comment
  "messenger", // Facebook Messenger DM
] as const;
export type ReplyPlatform = (typeof REPLY_PLATFORMS)[number];

/** Detected intent of the inbound message (classifier output). */
export const REPLY_INTENTS = [
  "booking", // wants an appointment
  "price", // asks about price / cost
  "complaint", // negative — never auto-sent
  "compliment", // positive feedback / praise
  "other", // none of the above
] as const;
export type ReplyIntent = (typeof REPLY_INTENTS)[number];

/**
 * Lifecycle of a queue row.
 * - pending      awaiting human decision in /inbox (e.g. AI drafted, guard held)
 * - auto_sent    engine sent it automatically (rules + guards passed)
 * - manual_sent  human approved/edited and sent from /inbox
 * - escalated    flagged for human attention (complaint / low rating) — alert fired
 * - skipped      human dismissed without replying
 */
export const REPLY_STATUSES = [
  "pending",
  "auto_sent",
  "manual_sent",
  "escalated",
  "skipped",
] as const;
export type ReplyStatus = (typeof REPLY_STATUSES)[number];

export const replyQueueTable = pgTable(
  "reply_queue",
  {
    id: serial("id").primaryKey(),
    brandId: integer("brand_id")
      .references(() => brandsTable.id, { onDelete: "cascade" })
      .notNull(),
    platform: text("platform").$type<ReplyPlatform>().notNull(),
    /**
     * Stable external identifier so we never double-process the same item:
     * - google     → the review's google_review_id / resource name
     * - facebook   → the comment id
     * - instagram  → the comment id
     * - messenger  → the message/mid (rarely queued, kept for symmetry)
     */
    externalId: text("external_id"),
    /** Optional FK into reviews table when platform = google (for reply-gmb reuse). */
    reviewId: integer("review_id"),
    /** Author display name when available (for the UI). */
    authorName: text("author_name"),
    /** Star rating when platform = google (1-5), null otherwise. */
    rating: integer("rating"),
    originalMessage: text("original_message"),
    suggestedReply: text("suggested_reply"),
    /** How the suggested reply will be / was delivered: public | private. */
    replyMode: text("reply_mode").$type<"public" | "private">(),
    intent: text("intent").$type<ReplyIntent>(),
    /** -1.00 (very negative) .. 1.00 (very positive). */
    sentiment: decimal("sentiment", { precision: 3, scale: 2 }),
    status: text("status").$type<ReplyStatus>().notNull().default("pending"),
    /** Why a row was escalated / skipped / held — surfaced in the UI. */
    statusReason: text("status_reason"),
    sentReply: text("sent_reply"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    brandStatusIdx: index("idx_reply_queue_brand_status").on(
      table.brandId,
      table.status,
    ),
    platformIdx: index("idx_reply_queue_platform").on(table.platform),
    createdAtIdx: index("idx_reply_queue_created_at").on(table.createdAt),
    platformCheck: check(
      "reply_queue_platform_check",
      sql`${table.platform} IN ('google', 'facebook', 'instagram', 'messenger')`,
    ),
    statusCheck: check(
      "reply_queue_status_check",
      sql`${table.status} IN ('pending', 'auto_sent', 'manual_sent', 'escalated', 'skipped')`,
    ),
  }),
);

export type ReplyQueueRow = typeof replyQueueTable.$inferSelect;
export type InsertReplyQueueRow = typeof replyQueueTable.$inferInsert;
