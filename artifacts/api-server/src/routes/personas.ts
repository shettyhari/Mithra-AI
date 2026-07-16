import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { personasTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const CreatePersonaBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  systemPrompt: z.string().min(1),
  avatarEmoji: z.string().optional().default("🤖"),
  isDefault: z.boolean().optional().default(false),
});

const UpdatePersonaBody = CreatePersonaBody.partial();

// GET /personas
router.get("/personas", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const personas = await db.select().from(personasTable)
    .where(eq(personasTable.userId, userId))
    .orderBy(personasTable.createdAt);
  res.json(personas);
});

// POST /personas
router.post("/personas", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePersonaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.userId!;

  // If setting as default, clear existing defaults
  if (parsed.data.isDefault) {
    await db.update(personasTable)
      .set({ isDefault: false })
      .where(eq(personasTable.userId, userId));
  }

  const [persona] = await db.insert(personasTable).values({
    userId,
    ...parsed.data,
  }).returning();
  res.status(201).json(persona);
});

// PUT /personas/:id
router.put("/personas/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt((req.params.id as string));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid persona ID" });
    return;
  }
  const parsed = UpdatePersonaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.userId!;

  const [existing] = await db.select().from(personasTable)
    .where(and(eq(personasTable.id, id), eq(personasTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }

  // If setting as default, clear existing defaults
  if (parsed.data.isDefault) {
    await db.update(personasTable)
      .set({ isDefault: false })
      .where(eq(personasTable.userId, userId));
  }

  const [updated] = await db.update(personasTable)
    .set(parsed.data)
    .where(eq(personasTable.id, id))
    .returning();
  res.json(updated);
});

// DELETE /personas/:id
router.delete("/personas/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt((req.params.id as string));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid persona ID" });
    return;
  }
  const userId = req.userId!;
  const [existing] = await db.select().from(personasTable)
    .where(and(eq(personasTable.id, id), eq(personasTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }
  await db.delete(personasTable).where(eq(personasTable.id, id));
  res.sendStatus(204);
});

export default router;
