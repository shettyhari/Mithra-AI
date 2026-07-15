import { Router } from "express";
import { db } from "@workspace/db";
import { automationsTable, notificationsTable, tasksTable, chatsTable, messagesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { callAi } from "../lib/ai";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const automations = await db.select().from(automationsTable)
      .where(eq(automationsTable.userId, req.userId!))
      .orderBy(desc(automationsTable.createdAt));
    res.json(automations);
  } catch (e) { res.status(500).json({ error: "Failed to fetch automations" }); }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, description, triggerType, triggerConfig, actionType, actionConfig } = req.body;
    if (!name || !triggerType || !actionType) return res.status(400).json({ error: "name, triggerType, actionType required" });
    const [automation] = await db.insert(automationsTable).values({
      userId: req.userId!, name, description,
      triggerType, triggerConfig: triggerConfig ? JSON.stringify(triggerConfig) : null,
      actionType, actionConfig: actionConfig ? JSON.stringify(actionConfig) : null,
    }).returning();
    res.status(201).json(automation);
  } catch (e) { res.status(500).json({ error: "Failed to create automation" }); }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { triggerConfig, actionConfig, ...rest } = req.body;
    const [automation] = await db.update(automationsTable).set({
      ...rest,
      ...(triggerConfig !== undefined ? { triggerConfig: JSON.stringify(triggerConfig) } : {}),
      ...(actionConfig !== undefined ? { actionConfig: JSON.stringify(actionConfig) } : {}),
    }).where(and(eq(automationsTable.id, id), eq(automationsTable.userId, req.userId!))).returning();
    if (!automation) return res.status(404).json({ error: "Automation not found" });
    res.json(automation);
  } catch (e) { res.status(500).json({ error: "Failed to update automation" }); }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(automationsTable).where(and(eq(automationsTable.id, id), eq(automationsTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Failed to delete automation" }); }
});

// Manually run an automation
router.post("/:id/run", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [automation] = await db.select().from(automationsTable)
      .where(and(eq(automationsTable.id, id), eq(automationsTable.userId, req.userId!)));
    if (!automation) return res.status(404).json({ error: "Automation not found" });

    const actionConfig = automation.actionConfig ? JSON.parse(automation.actionConfig) : {};
    let result = "";

    if (automation.actionType === "send_notification") {
      const title = actionConfig.notificationTitle || automation.name;
      let body = actionConfig.body || "";
      if (actionConfig.prompt) {
        body = (await callAi([{ role: "user", content: actionConfig.prompt }], "gpt-4o-mini", 0.7, 512)).content;
      }
      await db.insert(notificationsTable).values({
        userId: req.userId!, type: "system", title, body, isRead: false,
      });
      result = `Notification sent: ${title}`;
    } else if (automation.actionType === "create_task") {
      const title = actionConfig.taskTitle || `Task from ${automation.name}`;
      await db.insert(tasksTable).values({
        userId: req.userId!, title, description: actionConfig.taskDescription,
        status: "todo", priority: "medium",
      });
      result = `Task created: ${title}`;
    } else if (automation.actionType === "ai_summary") {
      const prompt = actionConfig.prompt || "Give me a brief daily summary and motivational message.";
      const summary = (await callAi([{ role: "user", content: prompt }], "gpt-4o-mini", 0.7, 512)).content;
      await db.insert(notificationsTable).values({
        userId: req.userId!, type: "system", title: automation.name, body: summary, isRead: false,
      });
      result = `AI summary generated and sent as notification`;
    } else if (automation.actionType === "chat_message") {
      const chats = await db.select().from(chatsTable).where(eq(chatsTable.userId, req.userId!)).limit(1);
      if (chats.length > 0) {
        const prompt = actionConfig.prompt || "Give me a brief daily summary.";
        const response = (await callAi([{ role: "user", content: prompt }], "gpt-4o-mini", 0.7, 512)).content;
        await db.insert(messagesTable).values({ chatId: chats[0].id, role: "assistant", content: response });
        result = `Message sent to chat`;
      }
    }

    await db.update(automationsTable).set({
      lastRunAt: new Date(),
      runCount: (automation.runCount || 0) + 1,
    }).where(eq(automationsTable.id, id));

    res.json({ ok: true, result });
  } catch (e) {
    console.error("Automation run error:", e);
    res.status(500).json({ error: "Failed to run automation" });
  }
});

export default router;
