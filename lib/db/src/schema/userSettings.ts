import { pgTable, text, serial, timestamp, boolean, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const userSettingsTable = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  theme: text("theme").notNull().default("dark"),
  accentColor: text("accent_color").notNull().default("#8b5cf6"),
  language: text("language").notNull().default("en"),
  animationsEnabled: boolean("animations_enabled").notNull().default(true),
  voiceEnabled: boolean("voice_enabled").notNull().default(false),
  voiceId: text("voice_id"),
  voiceSpeed: real("voice_speed").notNull().default(1.0),
  voicePitch: real("voice_pitch").notNull().default(1.0),
  customInstructions: text("custom_instructions"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSettingsSchema = createInsertSchema(userSettingsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type UserSettings = typeof userSettingsTable.$inferSelect;
