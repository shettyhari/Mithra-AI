import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const familyMembersTable = pgTable("family_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(), // spouse | child | parent | sibling | other
  birthday: text("birthday"), // ISO date string yyyy-mm-dd
  notes: text("notes"),
  avatarUrl: text("avatar_url"),
  preferences: text("preferences"), // JSON string of key prefs to inject into AI context
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembersTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type FamilyMember = typeof familyMembersTable.$inferSelect;
