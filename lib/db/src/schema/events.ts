import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }),
  isAllDay: boolean("is_all_day").notNull().default(false),
  location: text("location"),
  recurrence: text("recurrence").default("none"), // 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  color: text("color").default("#8b5cf6"),
  familyMemberIds: text("family_member_ids"), // JSON array of family member IDs
  reminderMinutes: integer("reminder_minutes"),
  isSharedWithFamily: boolean("is_shared_with_family").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("events_user_id_idx").on(t.userId),
  index("events_start_at_idx").on(t.startAt),
]);

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type CalendarEvent = typeof eventsTable.$inferSelect;
