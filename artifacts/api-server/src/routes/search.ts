import { Router, type IRouter } from "express";
import { ilike, or, eq, and, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { chatsTable, messagesTable, filesTable, tasksTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { callAi } from "../lib/ai";
import { aiConfigTable } from "@workspace/db";

const router: IRouter = Router();

interface SearchResult {
  type: "chat" | "file" | "task" | "message";
  id: number;
  title: string;
  subtitle?: string;
  url: string;
  relevance: number;
}

// POST /search - unified LLM-powered search
router.post("/search", requireAuth, async (req, res): Promise<void> => {
  const { query, aiAnswer = true } = req.body as { query: string; aiAnswer?: boolean };
  if (!query?.trim()) {
    res.status(400).json({ error: "Query is required" });
    return;
  }

  const userId = req.userId!;
  const results: SearchResult[] = [];
  const q = `%${query.trim()}%`;

  // Search chats
  const chats = await db.select().from(chatsTable)
    .where(and(eq(chatsTable.userId, userId), ilike(chatsTable.title, q)))
    .limit(5);
  for (const c of chats) {
    results.push({ type: "chat", id: c.id, title: c.title, subtitle: `Chat · ${c.model || "AI"}`, url: `/chat/${c.id}`, relevance: 3 });
  }

  // Search messages
  const msgs = await db.select({ id: messagesTable.id, chatId: messagesTable.chatId, content: messagesTable.content, chatTitle: chatsTable.title })
    .from(messagesTable)
    .innerJoin(chatsTable, eq(messagesTable.chatId, chatsTable.id))
    .where(and(eq(chatsTable.userId, userId), ilike(messagesTable.content, q)))
    .limit(5);
  for (const m of msgs) {
    results.push({ type: "message", id: m.id, title: m.chatTitle || "Chat", subtitle: m.content.slice(0, 80) + (m.content.length > 80 ? "…" : ""), url: `/chat/${m.chatId}`, relevance: 2 });
  }

  // Search files
  const files = await db.select().from(filesTable)
    .where(and(eq(filesTable.userId, userId), ilike(filesTable.name, q)))
    .limit(5);
  for (const f of files) {
    results.push({ type: "file", id: f.id, title: f.name, subtitle: `${f.type} · ${(f.size / 1024).toFixed(1)} KB`, url: `/files`, relevance: 2 });
  }

  // Search tasks
  const tasks = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), or(ilike(tasksTable.title, q), ilike(tasksTable.description ?? "", q))!))
    .limit(5);
  for (const t of tasks) {
    results.push({ type: "task", id: t.id, title: t.title, subtitle: `${t.priority} priority · ${t.status}`, url: `/tasks`, relevance: 1 });
  }

  // Sort by relevance
  results.sort((a, b) => b.relevance - a.relevance);

  // AI answer
  let answer: string | null = null;
  if (aiAnswer && query.trim()) {
    try {
      const [config] = await db.select().from(aiConfigTable).where(eq(aiConfigTable.userId, userId));
      const modelId = config?.defaultModel ?? "gpt-4o-mini";

      // Build context from search results
      const context = results.length > 0
        ? `The user has these matching items:\n${results.map(r => `- [${r.type.toUpperCase()}] ${r.title}: ${r.subtitle || ""}`).join("\n")}`
        : "No matching items found in the user's data.";

      const aiResponse = await callAi(
        [{ role: "user", content: `User query: "${query}"\n\n${context}\n\nProvide a helpful, concise answer (2-3 sentences max). If the user is searching for something specific, summarize what you found. If it's a question, answer it directly.` }],
        modelId,
        0.3,
        300,
        "You are Mithra, an AI family assistant. Answer search queries concisely and helpfully.",
      );
      answer = aiResponse.content;
    } catch {
      answer = null;
    }
  }

  res.json({ results: results.slice(0, 10), answer, query });
});

export default router;
