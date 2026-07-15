import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { chatsTable, messagesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import crypto from "crypto";

const router: IRouter = Router();

// POST /chats/:chatId/share  — generate or return share token
router.post("/chats/:chatId/share", requireAuth, async (req, res): Promise<void> => {
  const chatId = parseInt(req.params.chatId);
  if (isNaN(chatId)) { res.status(400).json({ error: "Invalid chat ID" }); return; }

  const [chat] = await db.select().from(chatsTable)
    .where(and(eq(chatsTable.id, chatId), eq(chatsTable.userId, req.userId!)));
  if (!chat) { res.status(404).json({ error: "Chat not found" }); return; }

  const token = chat.shareToken ?? crypto.randomBytes(16).toString("hex");
  if (!chat.shareToken) {
    await db.update(chatsTable).set({ shareToken: token }).where(eq(chatsTable.id, chatId));
  }
  res.json({ shareToken: token, shareUrl: `/shared/${token}` });
});

// DELETE /chats/:chatId/share  — revoke share token
router.delete("/chats/:chatId/share", requireAuth, async (req, res): Promise<void> => {
  const chatId = parseInt(req.params.chatId);
  if (isNaN(chatId)) { res.status(400).json({ error: "Invalid chat ID" }); return; }

  const [chat] = await db.select().from(chatsTable)
    .where(and(eq(chatsTable.id, chatId), eq(chatsTable.userId, req.userId!)));
  if (!chat) { res.status(404).json({ error: "Chat not found" }); return; }

  await db.update(chatsTable).set({ shareToken: null }).where(eq(chatsTable.id, chatId));
  res.sendStatus(204);
});

// GET /shared/:token  — public; no auth required
router.get("/shared/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  const [chat] = await db.select().from(chatsTable).where(eq(chatsTable.shareToken, token));
  if (!chat) { res.status(404).json({ error: "Shared chat not found" }); return; }

  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.chatId, chat.id))
    .orderBy(asc(messagesTable.createdAt));

  res.json({
    chat: {
      id: chat.id,
      title: chat.title,
      model: chat.model,
      createdAt: chat.createdAt.toISOString(),
    },
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      model: m.model,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

export default router;
