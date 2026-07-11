import { Router, type IRouter } from "express";
import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { chatsTable, messagesTable, filesTable, tasksTable, notificationsTable, usersTable, aiConfigTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";
import {
  GetDashboardSummaryResponse,
  GetUsageStatsResponseItem,
  GetFamilyActivityResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /dashboard/summary
router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;

  const [chatCount] = await db.select({ count: sql<number>`count(*)::int` }).from(chatsTable).where(eq(chatsTable.userId, userId));
  const [msgCount] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable)
    .innerJoin(chatsTable, eq(messagesTable.chatId, chatsTable.id))
    .where(eq(chatsTable.userId, userId));
  const [fileCount] = await db.select({ count: sql<number>`count(*)::int` }).from(filesTable).where(eq(filesTable.userId, userId));
  const [taskCount] = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(eq(tasksTable.userId, userId));
  const [doneCount] = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), eq(tasksTable.status, "done")));
  const [unreadCount] = await db.select({ count: sql<number>`count(*)::int` }).from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [tokensToday] = await db.select({ total: sql<number>`coalesce(sum(${messagesTable.tokensUsed}), 0)::int` })
    .from(messagesTable)
    .innerJoin(chatsTable, eq(messagesTable.chatId, chatsTable.id))
    .where(and(eq(chatsTable.userId, userId), gte(messagesTable.createdAt, today)));

  const [config] = await db.select().from(aiConfigTable).where(eq(aiConfigTable.userId, userId));

  res.json(GetDashboardSummaryResponse.parse({
    totalChats: chatCount?.count ?? 0,
    totalMessages: msgCount?.count ?? 0,
    totalFiles: fileCount?.count ?? 0,
    totalTasks: taskCount?.count ?? 0,
    completedTasks: doneCount?.count ?? 0,
    unreadNotifications: unreadCount?.count ?? 0,
    tokensUsedToday: tokensToday?.total ?? 0,
    activeModel: config?.defaultModel ?? "gpt-4o-mini",
  }));
});

// GET /dashboard/usage
router.get("/dashboard/usage", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const days = 7;
  const result: Array<{ date: string; tokens: number; messages: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const [tokensRow] = await db.select({ total: sql<number>`coalesce(sum(${messagesTable.tokensUsed}), 0)::int` })
      .from(messagesTable)
      .innerJoin(chatsTable, eq(messagesTable.chatId, chatsTable.id))
      .where(and(
        eq(chatsTable.userId, userId),
        gte(messagesTable.createdAt, date),
        sql`${messagesTable.createdAt} < ${nextDate}`,
      ));

    const [msgRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(messagesTable)
      .innerJoin(chatsTable, eq(messagesTable.chatId, chatsTable.id))
      .where(and(
        eq(chatsTable.userId, userId),
        gte(messagesTable.createdAt, date),
        sql`${messagesTable.createdAt} < ${nextDate}`,
      ));

    result.push({
      date: date.toISOString().split("T")[0],
      tokens: tokensRow?.total ?? 0,
      messages: msgRow?.count ?? 0,
    });
  }

  res.json(result.map(r => GetUsageStatsResponseItem.parse(r)));
});

// GET /dashboard/family-activity (admin only)
router.get("/dashboard/family-activity", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).where(eq(usersTable.isActive, true));
  const result = await Promise.all(users.map(async (user) => {
    const [chatCount] = await db.select({ count: sql<number>`count(*)::int` }).from(chatsTable).where(eq(chatsTable.userId, user.id));
    const [msgCount] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable)
      .innerJoin(chatsTable, eq(messagesTable.chatId, chatsTable.id))
      .where(eq(chatsTable.userId, user.id));
    const [fileCount] = await db.select({ count: sql<number>`count(*)::int` }).from(filesTable).where(eq(filesTable.userId, user.id));
    const [tokensRow] = await db.select({ total: sql<number>`coalesce(sum(${messagesTable.tokensUsed}), 0)::int` })
      .from(messagesTable)
      .innerJoin(chatsTable, eq(messagesTable.chatId, chatsTable.id))
      .where(eq(chatsTable.userId, user.id));

    return GetFamilyActivityResponseItem.parse({
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      chats: chatCount?.count ?? 0,
      messages: msgCount?.count ?? 0,
      filesUploaded: fileCount?.count ?? 0,
      tokensUsed: tokensRow?.total ?? 0,
      lastActive: user.lastActiveAt?.toISOString() ?? null,
    });
  }));
  res.json(result);
});

export default router;
