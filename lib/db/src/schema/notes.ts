import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  color: text("color").default("#ffffff"),
  emoji: text("emoji").default("📝"),
  isPinned: boolean("is_pinned").notNull().default(false),
  tags: text("tags"), // JSON array stored as text
  aiSummary: text("ai_summary"),
  aiSummarizedAt: timestamp("ai_summarized_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("notes_user_id_idx").on(t.userId),
  index("notes_pinned_idx").on(t.userId, t.isPinned),
]);

export const insertNoteSchema = createInsertSchema(notesTable).omit({
  id: true, createdAt: true, updatedAt: true, aiSummary: true, aiSummarizedAt: true,
});

export type Note = typeof notesTable.$inferSelect;
