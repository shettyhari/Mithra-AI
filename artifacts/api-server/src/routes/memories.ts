import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { memoriesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const CreateMemoryBody = z.object({
  content: z.string().min(1),
  category: z.enum(["general", "preference", "fact", "goal", "relationship"]).optional().default("general"),
  sourceChatId: z.number().int().optional(),
});

// GET /memories
router.get("/memories", requireAuth, async (req, res): Promise<void> => {
  const memories = await db.select().from(memoriesTable)
    .where(eq(memoriesTable.userId, req.userId!))
    .orderBy(desc(memoriesTable.createdAt));
  res.json(memories);
});

// POST /memories
router.post("/memories", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [memory] = await db.insert(memoriesTable).values({
    userId: req.userId!,
    content: parsed.data.content,
    category: parsed.data.category,
    sourceChatId: parsed.data.sourceChatId ?? null,
  }).returning();
  res.status(201).json(memory);
});

// DELETE /memories/:id
router.delete("/memories/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid memory ID" }); return; }
  const [existing] = await db.select().from(memoriesTable)
    .where(and(eq(memoriesTable.id, id), eq(memoriesTable.userId, req.userId!)));
  if (!existing) { res.status(404).json({ error: "Memory not found" }); return; }
  await db.delete(memoriesTable).where(eq(memoriesTable.id, id));
  res.sendStatus(204);
});

// DELETE /memories  — bulk delete by IDs
router.delete("/memories", requireAuth, async (req, res): Promise<void> => {
  const parsed = z.object({ ids: z.array(z.number().int()) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { ids } = parsed.data;
  if (ids.length === 0) { res.sendStatus(204); return; }
  await db.delete(memoriesTable)
    .where(and(eq(memoriesTable.userId, req.userId!), inArray(memoriesTable.id, ids)));
  res.sendStatus(204);
});

export default router;
