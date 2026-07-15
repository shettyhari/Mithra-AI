import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const chatsTable = pgTable("chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  model: text("model"),
  folder: text("folder"),
  isPinned: boolean("is_pinned").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  personaId: integer("persona_id"), // nullable FK to personas, set after personas table is created
  shareToken: text("share_token"), // nullable; set when user shares a chat
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("chats_user_id_idx").on(t.userId),
  index("chats_updated_at_idx").on(t.updatedAt),
  index("chats_share_token_idx").on(t.shareToken),
]);

export const insertChatSchema = createInsertSchema(chatsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertChat = z.infer<typeof insertChatSchema>;
export type Chat = typeof chatsTable.$inferSelect;
