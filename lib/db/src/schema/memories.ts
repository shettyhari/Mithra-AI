import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { chatsTable } from "./chats";

export const memoriesTable = pgTable("memories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sourceChatId: integer("source_chat_id").references(() => chatsTable.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"), // general | preference | fact | goal | relationship
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("memories_user_id_idx").on(t.userId),
]);

export const insertMemorySchema = createInsertSchema(memoriesTable).omit({
  id: true, createdAt: true,
});
export type Memory = typeof memoriesTable.$inferSelect;
