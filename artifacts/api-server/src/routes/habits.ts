import { Router } from "express";
import { db } from "@workspace/db";
import { habitsTable, habitCompletionsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

function computeStreak(completions: string[]): { current: number; longest: number } {
  if (!completions.length) return { current: 0, longest: 0 };
  const sorted = [...new Set(completions)].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (sorted[0] !== today && sorted[0] !== yesterday) return { current: 0, longest: 0 };

  let current = 0, longest = 0, streak = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (!prev) { streak = 1; prev = d; continue; }
    const prevDate = new Date(prev);
    const currDate = new Date(d);
    const diff = Math.round((prevDate.getTime() - currDate.getTime()) / 86400000);
    if (diff === 1) { streak++; } else { longest = Math.max(longest, streak); streak = 1; }
    prev = d;
  }
  longest = Math.max(longest, streak);
  current = sorted[0] === today || sorted[0] === yesterday ? streak : 0;
  return { current, longest };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const habits = await db.select().from(habitsTable)
      .where(eq(habitsTable.userId, req.userId!))
      .orderBy(desc(habitsTable.createdAt));

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const completions = await db.select().from(habitCompletionsTable)
      .where(and(eq(habitCompletionsTable.userId, req.userId!), gte(habitCompletionsTable.completedDate, thirtyDaysAgo)));

    const completionsByHabit = completions.reduce<Record<number, string[]>>((acc, c) => {
      acc[c.habitId] = acc[c.habitId] || [];
      acc[c.habitId].push(c.completedDate);
      return acc;
    }, {});

    const enriched = habits.map(h => {
      const dates = completionsByHabit[h.id] || [];
      const today = new Date().toISOString().slice(0, 10);
      return { ...h, completedToday: dates.includes(today), ...computeStreak(dates), recentDates: dates.slice(0, 30) };
    });
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: "Failed to fetch habits" }); }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, description, emoji, color, frequency, targetDaysPerWeek } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    const today = new Date().toISOString().slice(0, 10);
    const [habit] = await db.insert(habitsTable).values({
      userId: req.userId!, title, description, emoji: emoji ?? "⭐",
      color: color ?? "#8b5cf6", frequency: frequency ?? "daily",
      targetDaysPerWeek: targetDaysPerWeek ?? 7, startDate: today,
    }).returning();
    res.status(201).json(habit);
  } catch (e) { res.status(500).json({ error: "Failed to create habit" }); }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params.id as string));
    const [habit] = await db.update(habitsTable).set(req.body)
      .where(and(eq(habitsTable.id, id), eq(habitsTable.userId, req.userId!))).returning();
    if (!habit) return res.status(404).json({ error: "Habit not found" });
    res.json(habit);
  } catch (e) { res.status(500).json({ error: "Failed to update habit" }); }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params.id as string));
    await db.delete(habitsTable).where(and(eq(habitsTable.id, id), eq(habitsTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Failed to delete habit" }); }
});

// Toggle today's completion
router.post("/:id/complete", requireAuth, async (req, res) => {
  try {
    const habitId = parseInt((req.params.id as string));
    const { date, note } = req.body;
    const targetDate = date ?? new Date().toISOString().slice(0, 10);

    const existing = await db.select().from(habitCompletionsTable)
      .where(and(eq(habitCompletionsTable.habitId, habitId), eq(habitCompletionsTable.userId, req.userId!), eq(habitCompletionsTable.completedDate, targetDate)));

    if (existing.length > 0) {
      await db.delete(habitCompletionsTable).where(eq(habitCompletionsTable.id, existing[0].id));
      return res.json({ toggled: false, date: targetDate });
    }
    const [completion] = await db.insert(habitCompletionsTable).values({
      habitId, userId: req.userId!, completedDate: targetDate, note,
    }).returning();
    res.status(201).json({ toggled: true, completion });
  } catch (e) { res.status(500).json({ error: "Failed to toggle completion" }); }
});

// Get completions for a date range
router.get("/:id/completions", requireAuth, async (req, res) => {
  try {
    const habitId = parseInt((req.params.id as string));
    const { start } = req.query as { start?: string };
    const fromDate = start ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const completions = await db.select().from(habitCompletionsTable)
      .where(and(eq(habitCompletionsTable.habitId, habitId), eq(habitCompletionsTable.userId, req.userId!), gte(habitCompletionsTable.completedDate, fromDate)))
      .orderBy(desc(habitCompletionsTable.completedDate));
    res.json(completions);
  } catch (e) { res.status(500).json({ error: "Failed to fetch completions" }); }
});

export default router;
