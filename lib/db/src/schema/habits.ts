import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const habitsTable = pgTable("habits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  emoji: text("emoji").default("⭐"),
  color: text("color").default("#8b5cf6"),
  frequency: text("frequency").notNull().default("daily"), // 'daily' | 'weekly'
  targetDaysPerWeek: integer("target_days_per_week").default(7),
  isActive: boolean("is_active").notNull().default(true),
  startDate: text("start_date").notNull(), // 'YYYY-MM-DD'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("habits_user_id_idx").on(t.userId),
]);

export const habitCompletionsTable = pgTable("habit_completions", {
  id: serial("id").primaryKey(),
  habitId: integer("habit_id").notNull().references(() => habitsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  completedDate: text("completed_date").notNull(), // 'YYYY-MM-DD'
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("habit_completions_habit_id_idx").on(t.habitId),
  index("habit_completions_user_date_idx").on(t.userId, t.completedDate),
]);

export const insertHabitSchema = createInsertSchema(habitsTable).omit({
  id: true, createdAt: true,
});
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Habit = typeof habitsTable.$inferSelect;
export type HabitCompletion = typeof habitCompletionsTable.$inferSelect;
