import { pgTable, text, serial, timestamp, boolean, integer, index, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const budgetCategoriesTable = pgTable("budget_categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  emoji: text("emoji").default("💰"),
  color: text("color").default("#8b5cf6"),
  type: text("type").notNull().default("expense"), // 'income' | 'expense'
  monthlyBudget: numeric("monthly_budget", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("budget_categories_user_id_idx").on(t.userId),
]);

export const budgetTransactionsTable = pgTable("budget_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => budgetCategoriesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull().default("expense"), // 'income' | 'expense'
  date: text("date").notNull(), // 'YYYY-MM-DD'
  note: text("note"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringPeriod: text("recurring_period"), // 'weekly' | 'monthly' | 'yearly'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("budget_transactions_user_id_idx").on(t.userId),
  index("budget_transactions_date_idx").on(t.date),
]);

export const insertBudgetCategorySchema = createInsertSchema(budgetCategoriesTable).omit({ id: true, createdAt: true });
export const insertBudgetTransactionSchema = createInsertSchema(budgetTransactionsTable).omit({ id: true, createdAt: true });

export type BudgetCategory = typeof budgetCategoriesTable.$inferSelect;
export type BudgetTransaction = typeof budgetTransactionsTable.$inferSelect;
export type InsertBudgetCategory = z.infer<typeof insertBudgetCategorySchema>;
export type InsertBudgetTransaction = z.infer<typeof insertBudgetTransactionSchema>;
