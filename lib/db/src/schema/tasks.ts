import { pgTable, text, serial, timestamp, boolean, integer, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // 'todo' | 'in_progress' | 'done'
  priority: text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high'
  dueDate: date("due_date", { mode: "string" }),
  isShared: boolean("is_shared").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("tasks_user_id_idx").on(t.userId),
  index("tasks_status_idx").on(t.userId, t.status),
]);

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type Task = typeof tasksTable.$inferSelect;
