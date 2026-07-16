import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { familyMembersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const CreateFamilyMemberBody = z.object({
  name: z.string().min(1).max(100),
  relationship: z.enum(["spouse", "child", "parent", "sibling", "other"]),
  birthday: z.string().optional(), // yyyy-mm-dd
  notes: z.string().optional(),
  avatarUrl: z.string().optional(),
  preferences: z.string().optional(), // JSON string
});

const UpdateFamilyMemberBody = CreateFamilyMemberBody.partial();

// GET /family
router.get("/family", requireAuth, async (req, res): Promise<void> => {
  const members = await db.select().from(familyMembersTable)
    .where(eq(familyMembersTable.userId, req.userId!))
    .orderBy(familyMembersTable.createdAt);
  res.json(members);
});

// POST /family
router.post("/family", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateFamilyMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [member] = await db.insert(familyMembersTable).values({
    userId: req.userId!,
    ...parsed.data,
    birthday: parsed.data.birthday ?? null,
    notes: parsed.data.notes ?? null,
    avatarUrl: parsed.data.avatarUrl ?? null,
    preferences: parsed.data.preferences ?? null,
  }).returning();
  res.status(201).json(member);
});

// PUT /family/:id
router.put("/family/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt((req.params.id as string));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateFamilyMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(familyMembersTable)
    .where(and(eq(familyMembersTable.id, id), eq(familyMembersTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Family member not found" });
    return;
  }
  const [updated] = await db.update(familyMembersTable)
    .set(parsed.data)
    .where(eq(familyMembersTable.id, id))
    .returning();
  res.json(updated);
});

// DELETE /family/:id
router.delete("/family/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt((req.params.id as string));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [existing] = await db.select().from(familyMembersTable)
    .where(and(eq(familyMembersTable.id, id), eq(familyMembersTable.userId, req.userId!)));
  if (!existing) {
    res.status(404).json({ error: "Family member not found" });
    return;
  }
  await db.delete(familyMembersTable).where(eq(familyMembersTable.id, id));
  res.sendStatus(204);
});

export default router;
