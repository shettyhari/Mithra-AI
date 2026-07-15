import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const automationsTable = pgTable("automations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull(), // 'daily_digest' | 'weekly_summary' | 'birthday_check' | 'task_reminder' | 'custom'
  triggerConfig: text("trigger_config"), // JSON: { hour, days[], etc. }
  actionType: text("action_type").notNull(), // 'send_notification' | 'create_task' | 'ai_summary' | 'chat_message'
  actionConfig: text("action_config"), // JSON: { prompt, chatId, taskTitle, notificationTitle }
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  runCount: integer("run_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("automations_user_id_idx").on(t.userId),
]);

export const insertAutomationSchema = createInsertSchema(automationsTable).omit({
  id: true, createdAt: true, updatedAt: true, lastRunAt: true, runCount: true,
});
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automationsTable.$inferSelect;
