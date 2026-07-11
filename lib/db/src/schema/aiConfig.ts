import { pgTable, text, serial, timestamp, boolean, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Per-user AI config (optional override)
export const aiConfigTable = pgTable("ai_config", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"), // null = global default
  defaultModel: text("default_model").notNull().default("gpt-4o-mini"),
  temperature: real("temperature").notNull().default(0.7),
  maxTokens: integer("max_tokens").notNull().default(2048),
  streamingEnabled: boolean("streaming_enabled").notNull().default(true),
  systemPrompt: text("system_prompt"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Admin-managed API keys (stored encrypted in DB)
export const aiKeysTable = pgTable("ai_keys", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(), // 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter'
  encryptedKey: text("encrypted_key"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAiConfigSchema = createInsertSchema(aiConfigTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertAiConfig = z.infer<typeof insertAiConfigSchema>;
export type AiConfig = typeof aiConfigTable.$inferSelect;

export const insertAiKeySchema = createInsertSchema(aiKeysTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertAiKey = z.infer<typeof insertAiKeySchema>;
export type AiKey = typeof aiKeysTable.$inferSelect;
