import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  ListNotificationsQueryParams,
  ListNotificationsResponseItem,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  MarkAllNotificationsReadResponse,
  GetUnreadNotificationCountResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function serializeNotification(n: typeof notificationsTable.$inferSelect) {
  let fromUserName: string | null = null;
  if (n.fromUserId) {
    const [fromUser] = await db.select().from(usersTable).where(eq(usersTable.id, n.fromUserId));
    fromUserName = fromUser?.name ?? null;
  }
  return {
    id: n.id,
    userId: n.userId,
    fromUserId: n.fromUserId,
    fromUserName,
    type: n.type as "message" | "task" | "file_share" | "system" | "family_update",
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

// GET /notifications/unread-count
router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const [row] = await db.select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, req.userId!), eq(notificationsTable.isRead, false)));
  res.json(GetUnreadNotificationCountResponse.parse({ count: row?.count ?? 0 }));
});

// GET /notifications
router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const params = ListNotificationsQueryParams.safeParse(req.query);
  const filters = [eq(notificationsTable.userId, req.userId!)];
  if (params.data?.unreadOnly) filters.push(eq(notificationsTable.isRead, false));
  const notifications = await db.select().from(notificationsTable).where(and(...filters));
  const result = await Promise.all(notifications.map(serializeNotification));
  res.json(result.map(n => ListNotificationsResponseItem.parse(n)));
});

// PATCH /notifications/:notificationId/read
router.patch("/notifications/:notificationId/read", requireAuth, async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [n] = await db.select().from(notificationsTable)
    .where(and(eq(notificationsTable.id, params.data.notificationId), eq(notificationsTable.userId, req.userId!)));
  if (!n) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  const [updated] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, n.id)).returning();
  const serialized = await serializeNotification(updated);
  res.json(MarkNotificationReadResponse.parse(serialized));
});

// PATCH /notifications/read-all
router.patch("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, req.userId!));
  res.json(MarkAllNotificationsReadResponse.parse({ success: true }));
});

export default router;
