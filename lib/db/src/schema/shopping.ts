import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const shoppingListsTable = pgTable("shopping_lists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  emoji: text("emoji").default("🛒"),
  color: text("color").default("#10b981"),
  isSharedWithFamily: boolean("is_shared_with_family").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("shopping_lists_user_id_idx").on(t.userId),
]);

export const shoppingItemsTable = pgTable("shopping_items", {
  id: serial("id").primaryKey(),
  listId: integer("list_id").notNull().references(() => shoppingListsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: text("quantity"),
  category: text("category"),
  note: text("note"),
  isChecked: boolean("is_checked").notNull().default(false),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("shopping_items_list_id_idx").on(t.listId),
]);

export const insertShoppingListSchema = createInsertSchema(shoppingListsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertShoppingItemSchema = createInsertSchema(shoppingItemsTable).omit({ id: true, createdAt: true, checkedAt: true });

export type ShoppingList = typeof shoppingListsTable.$inferSelect;
export type ShoppingItem = typeof shoppingItemsTable.$inferSelect;
export type InsertShoppingList = z.infer<typeof insertShoppingListSchema>;
export type InsertShoppingItem = z.infer<typeof insertShoppingItemSchema>;
