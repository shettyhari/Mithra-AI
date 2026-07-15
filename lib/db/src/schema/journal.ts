import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // 'YYYY-MM-DD'
  title: text("title"),
  content: text("content").notNull(),
  mood: integer("mood"), // 1-5
  moodLabel: text("mood_label"), // 'terrible' | 'bad' | 'okay' | 'good' | 'amazing'
  tags: text("tags"), // JSON array stored as text
  aiReflection: text("ai_reflection"),
  aiReflectedAt: timestamp("ai_reflected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("journal_entries_user_id_idx").on(t.userId),
  index("journal_entries_date_idx").on(t.userId, t.date),
]);

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({
  id: true, createdAt: true, updatedAt: true, aiReflection: true, aiReflectedAt: true,
});

export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
