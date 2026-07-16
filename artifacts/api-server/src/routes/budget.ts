import { Router } from "express";
import { db } from "@workspace/db";
import { budgetCategoriesTable, budgetTransactionsTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { callAi } from "../lib/ai";

const router = Router();

// ── Categories ────────────────────────────────────────────────────
router.get("/categories", requireAuth, async (req, res) => {
  try {
    const cats = await db.select().from(budgetCategoriesTable)
      .where(eq(budgetCategoriesTable.userId, req.userId!))
      .orderBy(budgetCategoriesTable.name);
    res.json(cats);
  } catch { res.status(500).json({ error: "Failed to fetch categories" }); }
});

router.post("/categories", requireAuth, async (req, res) => {
  try {
    const { name, emoji, color, type, monthlyBudget } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const [cat] = await db.insert(budgetCategoriesTable).values({
      userId: req.userId!, name, emoji: emoji ?? "💰",
      color: color ?? "#8b5cf6", type: type ?? "expense",
      monthlyBudget: monthlyBudget ?? null,
    }).returning();
    res.status(201).json(cat);
  } catch { res.status(500).json({ error: "Failed to create category" }); }
});

router.put("/categories/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params.id as string));
    const { name, emoji, color, type, monthlyBudget } = req.body;
    const [cat] = await db.update(budgetCategoriesTable)
      .set({ name, emoji, color, type, monthlyBudget })
      .where(and(eq(budgetCategoriesTable.id, id), eq(budgetCategoriesTable.userId, req.userId!)))
      .returning();
    if (!cat) return res.status(404).json({ error: "Category not found" });
    res.json(cat);
  } catch { res.status(500).json({ error: "Failed to update category" }); }
});

router.delete("/categories/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params.id as string));
    await db.delete(budgetCategoriesTable)
      .where(and(eq(budgetCategoriesTable.id, id), eq(budgetCategoriesTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete category" }); }
});

// ── Transactions ──────────────────────────────────────────────────
router.get("/transactions", requireAuth, async (req, res) => {
  try {
    const { start, end, type, categoryId } = req.query as Record<string, string>;
    const conditions = [eq(budgetTransactionsTable.userId, req.userId!)];
    if (start) conditions.push(gte(budgetTransactionsTable.date, start));
    if (end) conditions.push(lte(budgetTransactionsTable.date, end));
    if (type) conditions.push(eq(budgetTransactionsTable.type, type));
    if (categoryId) conditions.push(eq(budgetTransactionsTable.categoryId, parseInt(categoryId)));

    const txns = await db.select({
      transaction: budgetTransactionsTable,
      category: budgetCategoriesTable,
    })
      .from(budgetTransactionsTable)
      .leftJoin(budgetCategoriesTable, eq(budgetTransactionsTable.categoryId, budgetCategoriesTable.id))
      .where(and(...conditions))
      .orderBy(desc(budgetTransactionsTable.date), desc(budgetTransactionsTable.createdAt));

    res.json(txns.map(r => ({ ...r.transaction, category: r.category })));
  } catch { res.status(500).json({ error: "Failed to fetch transactions" }); }
});

router.post("/transactions", requireAuth, async (req, res) => {
  try {
    const { title, amount, type, date, categoryId, note, isRecurring, recurringPeriod } = req.body;
    if (!title || !amount) return res.status(400).json({ error: "title and amount required" });
    const today = new Date().toISOString().slice(0, 10);
    const [txn] = await db.insert(budgetTransactionsTable).values({
      userId: req.userId!, title, amount: String(amount),
      type: type ?? "expense", date: date ?? today,
      categoryId: categoryId ?? null, note,
      isRecurring: isRecurring ?? false,
      recurringPeriod: recurringPeriod ?? null,
    }).returning();
    res.status(201).json(txn);
  } catch { res.status(500).json({ error: "Failed to create transaction" }); }
});

router.put("/transactions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params.id as string));
    const { title, amount, type, date, categoryId, note, isRecurring, recurringPeriod } = req.body;
    const [txn] = await db.update(budgetTransactionsTable)
      .set({ title, amount: amount ? String(amount) : undefined, type, date, categoryId, note, isRecurring, recurringPeriod })
      .where(and(eq(budgetTransactionsTable.id, id), eq(budgetTransactionsTable.userId, req.userId!)))
      .returning();
    if (!txn) return res.status(404).json({ error: "Transaction not found" });
    res.json(txn);
  } catch { res.status(500).json({ error: "Failed to update transaction" }); }
});

router.delete("/transactions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params.id as string));
    await db.delete(budgetTransactionsTable)
      .where(and(eq(budgetTransactionsTable.id, id), eq(budgetTransactionsTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete transaction" }); }
});

// ── Summary / Stats ───────────────────────────────────────────────
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const txns = await db.select().from(budgetTransactionsTable)
      .where(and(
        eq(budgetTransactionsTable.userId, req.userId!),
        gte(budgetTransactionsTable.date, startOfMonth),
        lte(budgetTransactionsTable.date, endOfMonth),
      ));

    const income = txns.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
    const expenses = txns.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
    const balance = income - expenses;

    // Category breakdown
    const cats = await db.select().from(budgetCategoriesTable)
      .where(eq(budgetCategoriesTable.userId, req.userId!));

    const byCategory = cats.map(cat => {
      const catTxns = txns.filter(t => t.categoryId === cat.id && t.type === "expense");
      const spent = catTxns.reduce((s, t) => s + parseFloat(t.amount), 0);
      const budget = cat.monthlyBudget ? parseFloat(cat.monthlyBudget) : 0;
      return { ...cat, spent, budget, remaining: budget > 0 ? budget - spent : null };
    }).filter(c => c.spent > 0 || (c.monthlyBudget && parseFloat(c.monthlyBudget) > 0));

    // Daily spending last 30 days
    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const recentTxns = await db.select().from(budgetTransactionsTable)
      .where(and(
        eq(budgetTransactionsTable.userId, req.userId!),
        gte(budgetTransactionsTable.date, thirtyAgo),
        eq(budgetTransactionsTable.type, "expense"),
      ))
      .orderBy(budgetTransactionsTable.date);

    const dailyMap: Record<string, number> = {};
    for (const t of recentTxns) {
      dailyMap[t.date] = (dailyMap[t.date] || 0) + parseFloat(t.amount);
    }
    const dailyData = Object.entries(dailyMap).map(([date, amount]) => ({ date, amount }));

    res.json({ income, expenses, balance, byCategory, dailyData, month: startOfMonth.slice(0, 7) });
  } catch { res.status(500).json({ error: "Failed to fetch summary" }); }
});

// ── AI Budget Advice ──────────────────────────────────────────────
router.post("/ai-advice", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const txns = await db.select().from(budgetTransactionsTable)
      .where(and(eq(budgetTransactionsTable.userId, req.userId!), gte(budgetTransactionsTable.date, startOfMonth)));

    const income = txns.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
    const expenses = txns.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);

    const topExpenses = txns
      .filter(t => t.type === "expense")
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
      .slice(0, 10)
      .map(t => `${t.title}: $${parseFloat(t.amount).toFixed(2)}`).join("\n");

    const prompt = `You are a personal finance advisor. Here is this month's financial summary:
Income: $${income.toFixed(2)}
Expenses: $${expenses.toFixed(2)}
Balance: $${(income - expenses).toFixed(2)}

Top expenses this month:
${topExpenses || "No expenses recorded"}

Give 3 specific, actionable pieces of financial advice in 2-3 sentences each. Be concise and helpful.`;

    const result = await callAi([{ role: "user", content: prompt }], "gpt-4o-mini", 0.7, 1024);
    const advice = result.content;
    res.json({ advice });
  } catch { res.status(500).json({ error: "Failed to get AI advice" }); }
});

export default router;
