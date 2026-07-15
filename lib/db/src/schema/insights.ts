import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const insightsTable = pgTable("insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'weekly_summary' | 'productivity_tip' | 'habit_insight'
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"), // JSON with chart data, stats
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (t) => [
  index("insights_user_id_idx").on(t.userId),
  index("insights_type_generated_idx").on(t.userId, t.type, t.generatedAt),
]);

export type Insight = typeof insightsTable.$inferSelect;
