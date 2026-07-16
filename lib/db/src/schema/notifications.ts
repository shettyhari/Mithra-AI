import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  fromUserId: integer("from_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  type: text("type").notNull(), // 'message' | 'task' | 'file_share' | 'system' | 'family_update'
  title: text("title").notNull(),
  body: text("body"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("notifications_user_id_idx").on(t.userId),
  index("notifications_is_read_idx").on(t.userId, t.isRead),
]);

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true, createdAt: true,
});
export type Notification = typeof notificationsTable.$inferSelect;
