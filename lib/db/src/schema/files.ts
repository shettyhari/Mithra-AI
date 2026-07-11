import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const filesTable = pgTable("files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'pdf' | 'image' | 'document' | 'video' | 'audio' | 'other'
  mimeType: text("mime_type"),
  size: integer("size").notNull().default(0), // bytes
  folder: text("folder"),
  url: text("url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFileSchema = createInsertSchema(filesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertFile = z.infer<typeof insertFileSchema>;
export type UserFile = typeof filesTable.$inferSelect;
