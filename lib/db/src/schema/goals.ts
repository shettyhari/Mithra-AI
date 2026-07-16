import { pgTable, text, serial, timestamp, boolean, integer, index, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  emoji: text("emoji").default("🎯"),
  color: text("color").default("#f59e0b"),
  category: text("category").default("personal"), // 'personal' | 'health' | 'finance' | 'learning' | 'family' | 'career'
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'paused' | 'abandoned'
  targetValue: numeric("target_value", { precision: 10, scale: 2 }),
  currentValue: numeric("current_value", { precision: 10, scale: 2 }).default("0"),
  unit: text("unit"), // 'km', 'lbs', '$', '%', etc.
  dueDate: text("due_date"), // 'YYYY-MM-DD'
  completedAt: timestamp("completed_at", { withTimezone: true }),
  isSharedWithFamily: boolean("is_shared_with_family").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("goals_user_id_idx").on(t.userId),
]);

export const goalMilestonesTable = pgTable("goal_milestones", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => goalsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  targetValue: numeric("target_value", { precision: 10, scale: 2 }),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  dueDate: text("due_date"), // 'YYYY-MM-DD'
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("goal_milestones_goal_id_idx").on(t.goalId),
]);

export const insertGoalSchema = createInsertSchema(goalsTable).omit({
  id: true, createdAt: true, updatedAt: true, completedAt: true,
});
export const insertGoalMilestoneSchema = createInsertSchema(goalMilestonesTable).omit({
  id: true, createdAt: true, completedAt: true,
});

export type Goal = typeof goalsTable.$inferSelect;
export type GoalMilestone = typeof goalMilestonesTable.$inferSelect;
