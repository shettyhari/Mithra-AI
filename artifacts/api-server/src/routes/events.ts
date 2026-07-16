import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    const conditions = [eq(eventsTable.userId, req.userId!)];
    if (start) conditions.push(gte(eventsTable.startAt, new Date(start)));
    if (end) conditions.push(lte(eventsTable.startAt, new Date(end)));
    const events = await db.select().from(eventsTable)
      .where(and(...conditions))
      .orderBy(eventsTable.startAt);
    res.json(events);
  } catch (e) { res.status(500).json({ error: "Failed to fetch events" }); }
});

router.get("/upcoming", requireAuth, async (req, res) => {
  try {
    const events = await db.select().from(eventsTable)
      .where(and(eq(eventsTable.userId, req.userId!), gte(eventsTable.startAt, new Date())))
      .orderBy(eventsTable.startAt)
      .limit(10);
    res.json(events);
  } catch (e) { res.status(500).json({ error: "Failed to fetch upcoming events" }); }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, description, startAt, endAt, isAllDay, location, recurrence, color, familyMemberIds, reminderMinutes, isSharedWithFamily } = req.body;
    if (!title || !startAt) return res.status(400).json({ error: "title and startAt required" });
    const [event] = await db.insert(eventsTable).values({
      userId: req.userId!, title, description, startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null, isAllDay: isAllDay ?? false,
      location, recurrence: recurrence ?? "none", color: color ?? "#8b5cf6",
      familyMemberIds: familyMemberIds ? JSON.stringify(familyMemberIds) : null,
      reminderMinutes, isSharedWithFamily: isSharedWithFamily ?? false,
    }).returning();
    res.status(201).json(event);
  } catch (e) { res.status(500).json({ error: "Failed to create event" }); }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params.id as string));
    const { startAt, endAt, ...rest } = req.body;
    const [event] = await db.update(eventsTable).set({
      ...rest,
      ...(startAt ? { startAt: new Date(startAt) } : {}),
      ...(endAt ? { endAt: new Date(endAt) } : {}),
    }).where(and(eq(eventsTable.id, id), eq(eventsTable.userId, req.userId!))).returning();
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (e) { res.status(500).json({ error: "Failed to update event" }); }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt((req.params.id as string));
    await db.delete(eventsTable).where(and(eq(eventsTable.id, id), eq(eventsTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Failed to delete event" }); }
});

export default router;
