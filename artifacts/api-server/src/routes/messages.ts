import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import { messagesTable, chatsTable, aiConfigTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { callAi, callAiStream } from "../lib/ai";
import {
  ListMessagesParams,
  ListMessagesResponseItem,
  SendMessageParams,
  SendMessageBody,
  SendMessageResponse,
  EditMessageParams,
  EditMessageBody,
  EditMessageResponse,
  DeleteMessageParams,
  RegenerateMessageParams,
  RegenerateMessageResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeMessage(msg: typeof messagesTable.$inferSelect) {
  return {
    id: msg.id,
    chatId: msg.chatId,
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content,
    model: msg.model,
    tokensUsed: msg.tokensUsed,
    imageUrl: msg.imageUrl,
    createdAt: msg.createdAt.toISOString(),
  };
}

// GET /chats/:chatId/messages
router.get("/chats/:chatId/messages", requireAuth, async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [chat] = await db.select().from(chatsTable)
    .where(and(eq(chatsTable.id, params.data.chatId), eq(chatsTable.userId, req.userId!)));
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.chatId, params.data.chatId))
    .orderBy(asc(messagesTable.createdAt));
  res.json(msgs.map(m => ListMessagesResponseItem.parse(serializeMessage(m))));
});

// POST /chats/:chatId/messages
router.post("/chats/:chatId/messages", requireAuth, async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const agentMode = !!parsed.data.agentMode;
  const reasoningMode = !!parsed.data.reasoningMode;
  const imageUrl = parsed.data.imageUrl ?? null;

  const [chat] = await db.select().from(chatsTable)
    .where(and(eq(chatsTable.id, params.data.chatId), eq(chatsTable.userId, req.userId!)));
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }

  // Get AI config for user
  const [aiConfig] = await db.select().from(aiConfigTable).where(eq(aiConfigTable.userId, req.userId!));
  const defaultConfig = aiConfig ?? { defaultModel: "gpt-4o-mini", temperature: 0.7, maxTokens: 2048, systemPrompt: null };
  const modelId = parsed.data.model ?? chat.model ?? defaultConfig.defaultModel;

  // Save user message
  const [userMsg] = await db.insert(messagesTable).values({
    chatId: params.data.chatId,
    role: "user",
    content: parsed.data.content,
    imageUrl,
  }).returning();

  // Get conversation history for context
  const history = await db.select().from(messagesTable)
    .where(eq(messagesTable.chatId, params.data.chatId))
    .orderBy(asc(messagesTable.createdAt))
    .limit(20);

  const aiMessages = history.map(m => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
    imageUrl: m.imageUrl ?? undefined,
  }));

  let aiContent = "";
  let tokensUsed = 0;
  try {
    const aiResponse = await callAi(
      aiMessages,
      modelId,
      defaultConfig.temperature,
      defaultConfig.maxTokens,
      defaultConfig.systemPrompt,
      agentMode,
      req.userId!,
      reasoningMode,
    );
    aiContent = aiResponse.content;
    tokensUsed = aiResponse.tokensUsed;
  } catch (err) {
    req.log.error({ err }, "AI call failed");
    aiContent = "I encountered an error processing your request. Please try again.";
  }

  // Save assistant message (store tool calls as JSON in content prefix if present)
  const [assistantMsg] = await db.insert(messagesTable).values({
    chatId: params.data.chatId,
    role: "assistant",
    content: aiContent,
    model: modelId,
    tokensUsed,
  }).returning();

  // Update chat's updatedAt
  await db.update(chatsTable).set({ updatedAt: new Date() }).where(eq(chatsTable.id, params.data.chatId));

  res.status(201).json(SendMessageResponse.parse({
    userMessage: serializeMessage(userMsg),
    assistantMessage: serializeMessage(assistantMsg),
  }));
});

// POST /chats/:chatId/messages/stream — SSE streaming variant.
// Not part of the generated OpenAPI client (which is strictly JSON/Promise
// based) — the frontend calls this directly with fetch + ReadableStream.
router.post("/chats/:chatId/messages/stream", requireAuth, async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const agentMode = !!parsed.data.agentMode;
  const reasoningMode = !!parsed.data.reasoningMode;
  const imageUrl = parsed.data.imageUrl ?? null;

  const [chat] = await db.select().from(chatsTable)
    .where(and(eq(chatsTable.id, params.data.chatId), eq(chatsTable.userId, req.userId!)));
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }

  const [aiConfig] = await db.select().from(aiConfigTable).where(eq(aiConfigTable.userId, req.userId!));
  const defaultConfig = aiConfig ?? { defaultModel: "gpt-4o-mini", temperature: 0.7, maxTokens: 2048, systemPrompt: null };
  const modelId = parsed.data.model ?? chat.model ?? defaultConfig.defaultModel;

  const [userMsg] = await db.insert(messagesTable).values({
    chatId: params.data.chatId,
    role: "user",
    content: parsed.data.content,
    imageUrl,
  }).returning();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  send("user_message", serializeMessage(userMsg));

  if (agentMode) {
    // Agentic tool-calling isn't incrementally streamable with the current
    // provider integration — fall back to the non-streaming call, then emit
    // the whole answer as one delta so the client's rendering path is uniform.
    try {
      const history = await db.select().from(messagesTable)
        .where(eq(messagesTable.chatId, params.data.chatId))
        .orderBy(asc(messagesTable.createdAt))
        .limit(20);
      const aiMessages = history.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content, imageUrl: m.imageUrl ?? undefined }));
      const aiResponse = await callAi(aiMessages, modelId, defaultConfig.temperature, defaultConfig.maxTokens, defaultConfig.systemPrompt, agentMode, req.userId!, reasoningMode);
      send("delta", { content: aiResponse.content });
      const [assistantMsg] = await db.insert(messagesTable).values({
        chatId: params.data.chatId, role: "assistant", content: aiResponse.content, model: modelId, tokensUsed: aiResponse.tokensUsed,
      }).returning();
      await db.update(chatsTable).set({ updatedAt: new Date() }).where(eq(chatsTable.id, params.data.chatId));
      send("done", { assistantMessage: serializeMessage(assistantMsg) });
    } catch (err) {
      req.log.error({ err }, "Streaming AI call (agent mode) failed");
      send("error", { error: "AI request failed" });
    }
    res.end();
    return;
  }

  try {
    const history = await db.select().from(messagesTable)
      .where(eq(messagesTable.chatId, params.data.chatId))
      .orderBy(asc(messagesTable.createdAt))
      .limit(20);
    const aiMessages = history.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content, imageUrl: m.imageUrl ?? undefined }));

    const result = await callAiStream(
      aiMessages, modelId, defaultConfig.temperature, defaultConfig.maxTokens, defaultConfig.systemPrompt, reasoningMode,
      (delta) => send("delta", { content: delta }),
    );

    const [assistantMsg] = await db.insert(messagesTable).values({
      chatId: params.data.chatId, role: "assistant", content: result.content, model: modelId, tokensUsed: result.tokensUsed,
    }).returning();
    await db.update(chatsTable).set({ updatedAt: new Date() }).where(eq(chatsTable.id, params.data.chatId));
    send("done", { assistantMessage: serializeMessage(assistantMsg) });
  } catch (err) {
    req.log.error({ err }, "Streaming AI call failed");
    send("error", { error: "AI request failed" });
  }
  res.end();
});

// PATCH /messages/:messageId
router.patch("/messages/:messageId", requireAuth, async (req, res): Promise<void> => {
  const params = EditMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = EditMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, params.data.messageId));
  if (!msg) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  // Verify ownership via chat
  const [chat] = await db.select().from(chatsTable).where(and(eq(chatsTable.id, msg.chatId), eq(chatsTable.userId, req.userId!)));
  if (!chat) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [updated] = await db.update(messagesTable).set({ content: parsed.data.content }).where(eq(messagesTable.id, params.data.messageId)).returning();
  res.json(EditMessageResponse.parse(serializeMessage(updated)));
});

// DELETE /messages/:messageId
router.delete("/messages/:messageId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, params.data.messageId));
  if (!msg) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  const [chat] = await db.select().from(chatsTable).where(and(eq(chatsTable.id, msg.chatId), eq(chatsTable.userId, req.userId!)));
  if (!chat) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(messagesTable).where(eq(messagesTable.id, params.data.messageId));
  res.sendStatus(204);
});

// POST /messages/:messageId/regenerate
router.post("/messages/:messageId/regenerate", requireAuth, async (req, res): Promise<void> => {
  const params = RegenerateMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, params.data.messageId));
  if (!msg || msg.role !== "assistant") {
    res.status(404).json({ error: "Assistant message not found" });
    return;
  }
  const [chat] = await db.select().from(chatsTable).where(and(eq(chatsTable.id, msg.chatId), eq(chatsTable.userId, req.userId!)));
  if (!chat) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [aiConfig] = await db.select().from(aiConfigTable).where(eq(aiConfigTable.userId, req.userId!));
  const defaultConfig = aiConfig ?? { defaultModel: "gpt-4o-mini", temperature: 0.7, maxTokens: 2048, systemPrompt: null };
  const modelId = msg.model ?? chat.model ?? defaultConfig.defaultModel;

  const history = await db.select().from(messagesTable)
    .where(and(eq(messagesTable.chatId, msg.chatId)))
    .orderBy(asc(messagesTable.createdAt));

  // Messages before this assistant message
  const idx = history.findIndex(m => m.id === msg.id);
  const contextMsgs = (idx > 0 ? history.slice(0, idx) : history).map(m => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  let aiContent = "";
  let tokensUsed = 0;
  try {
    const aiResponse = await callAi(contextMsgs, modelId, defaultConfig.temperature, defaultConfig.maxTokens, defaultConfig.systemPrompt);
    aiContent = aiResponse.content;
    tokensUsed = aiResponse.tokensUsed;
  } catch {
    aiContent = "Regeneration failed. Please try again.";
  }

  const [updated] = await db.update(messagesTable)
    .set({ content: aiContent, tokensUsed })
    .where(eq(messagesTable.id, params.data.messageId))
    .returning();

  res.json(RegenerateMessageResponse.parse(serializeMessage(updated)));
});

export default router;
