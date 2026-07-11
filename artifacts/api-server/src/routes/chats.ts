import { Router, type IRouter } from "express";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { chatsTable, messagesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  ListChatsQueryParams,
  ListChatsResponseItem,
  CreateChatBody,
  CreateChatResponse,
  GetChatParams,
  GetChatResponse,
  UpdateChatParams,
  UpdateChatBody,
  UpdateChatResponse,
  DeleteChatParams,
  ListPinnedChatsResponseItem,
  ListRecentChatsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeChat(chat: typeof chatsTable.$inferSelect, messageCount = 0, lastMessage: string | null = null) {
  return {
    id: chat.id,
    userId: chat.userId,
    title: chat.title,
    model: chat.model,
    folder: chat.folder,
    isPinned: chat.isPinned,
    isArchived: chat.isArchived,
    messageCount,
    lastMessage,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}

async function getChatWithMeta(chatId: number) {
  const [chat] = await db.select().from(chatsTable).where(eq(chatsTable.id, chatId));
  if (!chat) return null;
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.chatId, chatId)).orderBy(desc(messagesTable.createdAt)).limit(1);
  const lastMsg = msgs[0];
  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable).where(eq(messagesTable.chatId, chatId));
  return serializeChat(chat, countRow?.count ?? 0, lastMsg?.content?.slice(0, 100) ?? null);
}

// GET /chats
router.get("/chats", requireAuth, async (req, res): Promise<void> => {
  const params = ListChatsQueryParams.safeParse(req.query);
  const userId = req.userId!;
  let query = db.select().from(chatsTable).where(eq(chatsTable.userId, userId)).$dynamic();
  const filters = [eq(chatsTable.userId, userId)];
  if (params.data?.archived !== undefined && params.data.archived !== null) {
    filters.push(eq(chatsTable.isArchived, params.data.archived));
  } else {
    filters.push(eq(chatsTable.isArchived, false));
  }
  if (params.data?.pinned !== undefined && params.data.pinned !== null) {
    filters.push(eq(chatsTable.isPinned, params.data.pinned));
  }
  if (params.data?.folder) {
    filters.push(eq(chatsTable.folder, params.data.folder));
  }
  if (params.data?.search) {
    filters.push(ilike(chatsTable.title, `%${params.data.search}%`));
  }
  const chats = await db.select().from(chatsTable).where(and(...filters)).orderBy(desc(chatsTable.updatedAt));
  const result = await Promise.all(chats.map(async (chat) => {
    const msgs = await db.select().from(messagesTable).where(eq(messagesTable.chatId, chat.id)).orderBy(desc(messagesTable.createdAt)).limit(1);
    const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable).where(eq(messagesTable.chatId, chat.id));
    return ListChatsResponseItem.parse(serializeChat(chat, countRow?.count ?? 0, msgs[0]?.content?.slice(0, 100) ?? null));
  }));
  res.json(result);
});

// POST /chats
router.post("/chats", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [chat] = await db.insert(chatsTable).values({
    userId: req.userId!,
    title: parsed.data.title,
    model: parsed.data.model,
    folder: parsed.data.folder,
  }).returning();
  res.status(201).json(CreateChatResponse.parse(serializeChat(chat, 0, null)));
});

// GET /chats/pinned
router.get("/chats/pinned", requireAuth, async (req, res): Promise<void> => {
  const chats = await db.select().from(chatsTable)
    .where(and(eq(chatsTable.userId, req.userId!), eq(chatsTable.isPinned, true)))
    .orderBy(desc(chatsTable.updatedAt));
  const result = await Promise.all(chats.map(async (chat) => {
    const msgs = await db.select().from(messagesTable).where(eq(messagesTable.chatId, chat.id)).orderBy(desc(messagesTable.createdAt)).limit(1);
    const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable).where(eq(messagesTable.chatId, chat.id));
    return ListPinnedChatsResponseItem.parse(serializeChat(chat, countRow?.count ?? 0, msgs[0]?.content?.slice(0, 100) ?? null));
  }));
  res.json(result);
});

// GET /chats/recent
router.get("/chats/recent", requireAuth, async (req, res): Promise<void> => {
  const chats = await db.select().from(chatsTable)
    .where(and(eq(chatsTable.userId, req.userId!), eq(chatsTable.isArchived, false)))
    .orderBy(desc(chatsTable.updatedAt))
    .limit(10);
  const result = await Promise.all(chats.map(async (chat) => {
    const msgs = await db.select().from(messagesTable).where(eq(messagesTable.chatId, chat.id)).orderBy(desc(messagesTable.createdAt)).limit(1);
    const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable).where(eq(messagesTable.chatId, chat.id));
    return ListRecentChatsResponseItem.parse(serializeChat(chat, countRow?.count ?? 0, msgs[0]?.content?.slice(0, 100) ?? null));
  }));
  res.json(result);
});

// GET /chats/:chatId
router.get("/chats/:chatId", requireAuth, async (req, res): Promise<void> => {
  const params = GetChatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const chat = await getChatWithMeta(params.data.chatId);
  if (!chat || chat.userId !== req.userId) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  res.json(GetChatResponse.parse(chat));
});

// PATCH /chats/:chatId
router.patch("/chats/:chatId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateChatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(chatsTable)
    .where(and(eq(chatsTable.id, params.data.chatId), eq(chatsTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  await db.update(chatsTable).set(parsed.data).where(eq(chatsTable.id, params.data.chatId));
  const updated = await getChatWithMeta(params.data.chatId);
  res.json(UpdateChatResponse.parse(updated));
});

// DELETE /chats/:chatId
router.delete("/chats/:chatId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteChatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(chatsTable)
    .where(and(eq(chatsTable.id, params.data.chatId), eq(chatsTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  await db.delete(chatsTable).where(eq(chatsTable.id, params.data.chatId));
  res.sendStatus(204);
});

export default router;
