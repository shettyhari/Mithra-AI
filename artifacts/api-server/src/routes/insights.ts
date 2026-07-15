import { Router } from "express";
import { db } from "@workspace/db";
import { insightsTable, chatsTable, messagesTable, tasksTable, filesTable, habitsTable, habitCompletionsTable, eventsTable } from "@workspace/db";
import { eq, and, gte, desc, count, sum } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { callAi } from "../lib/ai";

const router = Router();

async function gatherStats(userId: number) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [chatCount] = await db.select({ count: count() }).from(chatsTable).where(eq(chatsTable.userId, userId));
  const [msgCount] = await db.select({ count: count() }).from(messagesTable)
    .where(and(eq(messagesTable.chatId, messagesTable.chatId), gte(messagesTable.createdAt, sevenDaysAgo)));
  const [taskStats] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.userId, userId));
  const [doneTaskStats] = await db.select({ count: count() }).from(tasksTable).where(and(eq(tasksTable.userId, userId), eq(tasksTable.status, "done")));
  const [fileCount] = await db.select({ count: count() }).from(filesTable).where(eq(filesTable.userId, userId));
  const [tokensRow] = await db.select({ total: sum(messagesTable.tokensUsed) }).from(messagesTable)
    .where(gte(messagesTable.createdAt, thirtyDaysAgo));
  const habitList = await db.select().from(habitsTable).where(and(eq(habitsTable.userId, userId), eq(habitsTable.isActive, true)));
  const completionsThisWeek = await db.select({ count: count() }).from(habitCompletionsTable)
    .where(and(eq(habitCompletionsTable.userId, userId), gte(habitCompletionsTable.completedDate, weekStart)));
  const upcomingEvents = await db.select({ count: count() }).from(eventsTable)
    .where(and(eq(eventsTable.userId, userId), gte(eventsTable.startAt, new Date())));

  return {
    totalChats: chatCount.count,
    messagesThisWeek: msgCount.count,
    totalTasks: taskStats.count,
    completedTasks: doneTaskStats.count,
    totalFiles: fileCount.count,
    tokensThisMonth: parseInt(String(tokensRow.total ?? "0")),
    activeHabits: habitList.length,
    habitCompletionsThisWeek: completionsThisWeek[0]?.count ?? 0,
    upcomingEvents: upcomingEvents[0]?.count ?? 0,
  };
}

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const stats = await gatherStats(req.userId!);
    res.json(stats);
  } catch (e) { res.status(500).json({ error: "Failed to fetch stats" }); }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const insights = await db.select().from(insightsTable)
      .where(eq(insightsTable.userId, req.userId!))
      .orderBy(desc(insightsTable.generatedAt))
      .limit(10);
    res.json(insights);
  } catch (e) { res.status(500).json({ error: "Failed to fetch insights" }); }
});

router.post("/generate", requireAuth, async (req, res) => {
  try {
    const { type = "weekly_summary" } = req.body;

    // Check if a fresh one exists (< 24h old)
    const recent = await db.select().from(insightsTable)
      .where(and(eq(insightsTable.userId, req.userId!), eq(insightsTable.type, type), gte(insightsTable.generatedAt, new Date(Date.now() - 23 * 3600000))))
      .limit(1);
    if (recent.length > 0 && !req.body.force) return res.json(recent[0]);

    const stats = await gatherStats(req.userId!);
    let prompt = "";
    let title = "";

    if (type === "weekly_summary") {
      title = "Weekly Intelligence Report";
      prompt = `You are Mithra, a family AI assistant. Generate a warm, insightful weekly summary based on these stats:
- Total chats: ${stats.totalChats}, messages this week: ${stats.messagesThisWeek}
- Tasks: ${stats.completedTasks}/${stats.totalTasks} completed
- Active habits: ${stats.activeHabits}, completions this week: ${stats.habitCompletionsThisWeek}
- Upcoming events: ${stats.upcomingEvents}
- Files stored: ${stats.totalFiles}
- AI tokens used this month: ${stats.tokensThisMonth}

Write a 3-4 sentence warm summary highlighting wins, gentle nudges for improvement, and one personalized tip. Be encouraging and specific.`;
    } else if (type === "productivity_tip") {
      title = "AI Productivity Tip";
      prompt = `Based on a user who has ${stats.totalTasks} tasks (${stats.completedTasks} done), ${stats.activeHabits} habits tracked, and ${stats.messagesThisWeek} AI conversations this week, give ONE specific, actionable productivity tip. Keep it under 3 sentences and make it feel personal.`;
    } else if (type === "habit_insight") {
      title = "Habit Intelligence";
      prompt = `A user has ${stats.activeHabits} active habits and completed ${stats.habitCompletionsThisWeek} times this week. Give a brief, motivating insight about their habit progress and one specific suggestion to improve. 2-3 sentences.`;
    }

    const content = (await callAi([{ role: "user", content: prompt }], "gpt-4o-mini", 0.7, 512)).content;
    const expiresAt = new Date(Date.now() + 7 * 86400000);

    const [insight] = await db.insert(insightsTable).values({
      userId: req.userId!, type, title, content,
      metadata: JSON.stringify(stats), expiresAt,
    }).returning();

    res.status(201).json(insight);
  } catch (e) {
    console.error("Insight generation error:", e);
    res.status(500).json({ error: "Failed to generate insight" });
  }
});

export default router;
