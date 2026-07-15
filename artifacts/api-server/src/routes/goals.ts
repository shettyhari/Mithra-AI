import { Router } from "express";
import { db } from "@workspace/db";
import { goalsTable, goalMilestonesTable } from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { callAi } from "../lib/ai";

const router = Router();

// ── Goals ──────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    const conditions = [eq(goalsTable.userId, req.userId!)];
    if (status) conditions.push(eq(goalsTable.status, status));

    const goals = await db.select().from(goalsTable)
      .where(and(...conditions))
      .orderBy(desc(goalsTable.createdAt));

    const enriched = await Promise.all(goals.map(async (goal) => {
      const milestones = await db.select().from(goalMilestonesTable)
        .where(eq(goalMilestonesTable.goalId, goal.id))
        .orderBy(asc(goalMilestonesTable.sortOrder));

      const target = goal.targetValue ? parseFloat(goal.targetValue) : 100;
      const current = goal.currentValue ? parseFloat(goal.currentValue) : 0;
      const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

      return { ...goal, milestones, progress };
    }));

    res.json(enriched);
  } catch { res.status(500).json({ error: "Failed to fetch goals" }); }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, description, emoji, color, category, targetValue, currentValue, unit, dueDate, isSharedWithFamily } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });

    const [goal] = await db.insert(goalsTable).values({
      userId: req.userId!, title, description,
      emoji: emoji ?? "🎯", color: color ?? "#f59e0b",
      category: category ?? "personal",
      targetValue: targetValue ? String(targetValue) : null,
      currentValue: currentValue ? String(currentValue) : "0",
      unit: unit ?? null, dueDate: dueDate ?? null,
      isSharedWithFamily: isSharedWithFamily ?? false,
    }).returning();

    res.status(201).json({ ...goal, milestones: [], progress: 0 });
  } catch { res.status(500).json({ error: "Failed to create goal" }); }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, emoji, color, category, status, targetValue, currentValue, unit, dueDate, isSharedWithFamily } = req.body;

    const updates: Record<string, unknown> = {
      title, description, emoji, color, category, status, unit, dueDate, isSharedWithFamily, updatedAt: new Date(),
    };
    if (targetValue !== undefined) updates.targetValue = String(targetValue);
    if (currentValue !== undefined) updates.currentValue = String(currentValue);
    if (status === "completed") updates.completedAt = new Date();

    const [goal] = await db.update(goalsTable)
      .set(updates)
      .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, req.userId!)))
      .returning();
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    res.json(goal);
  } catch { res.status(500).json({ error: "Failed to update goal" }); }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(goalsTable)
      .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete goal" }); }
});

// Update progress
router.patch("/:id/progress", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: "value required" });

    const [goal] = await db.select().from(goalsTable)
      .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, req.userId!)));
    if (!goal) return res.status(404).json({ error: "Goal not found" });

    const newValue = parseFloat(String(value));
    const target = goal.targetValue ? parseFloat(goal.targetValue) : null;
    const completed = target !== null && newValue >= target;

    const [updated] = await db.update(goalsTable)
      .set({
        currentValue: String(newValue),
        status: completed ? "completed" : goal.status,
        completedAt: completed ? new Date() : goal.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(goalsTable.id, id))
      .returning();

    const progress = target && target > 0 ? Math.min(100, Math.round((newValue / target) * 100)) : 0;
    res.json({ ...updated, progress });
  } catch { res.status(500).json({ error: "Failed to update progress" }); }
});

// ── Milestones ─────────────────────────────────────────────────────
router.post("/:id/milestones", requireAuth, async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    const { title, targetValue, dueDate, sortOrder } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });

    const [milestone] = await db.insert(goalMilestonesTable).values({
      goalId, userId: req.userId!, title,
      targetValue: targetValue ? String(targetValue) : null,
      dueDate: dueDate ?? null, sortOrder: sortOrder ?? 0,
    }).returning();
    res.status(201).json(milestone);
  } catch { res.status(500).json({ error: "Failed to create milestone" }); }
});

router.patch("/:id/milestones/:milestoneId", requireAuth, async (req, res) => {
  try {
    const milestoneId = parseInt(req.params.milestoneId);
    const { isCompleted, title, targetValue, dueDate } = req.body;

    const updates: Record<string, unknown> = { title, dueDate };
    if (targetValue !== undefined) updates.targetValue = String(targetValue);
    if (typeof isCompleted === "boolean") {
      updates.isCompleted = isCompleted;
      updates.completedAt = isCompleted ? new Date() : null;
    }

    const [m] = await db.update(goalMilestonesTable)
      .set(updates)
      .where(and(eq(goalMilestonesTable.id, milestoneId), eq(goalMilestonesTable.userId, req.userId!)))
      .returning();
    if (!m) return res.status(404).json({ error: "Milestone not found" });
    res.json(m);
  } catch { res.status(500).json({ error: "Failed to update milestone" }); }
});

router.delete("/:id/milestones/:milestoneId", requireAuth, async (req, res) => {
  try {
    const milestoneId = parseInt(req.params.milestoneId);
    await db.delete(goalMilestonesTable)
      .where(and(eq(goalMilestonesTable.id, milestoneId), eq(goalMilestonesTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete milestone" }); }
});

// AI coaching for a goal
router.post("/:id/coach", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [goal] = await db.select().from(goalsTable)
      .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, req.userId!)));
    if (!goal) return res.status(404).json({ error: "Goal not found" });

    const milestones = await db.select().from(goalMilestonesTable)
      .where(eq(goalMilestonesTable.goalId, id))
      .orderBy(asc(goalMilestonesTable.sortOrder));

    const target = goal.targetValue ? parseFloat(goal.targetValue) : null;
    const current = goal.currentValue ? parseFloat(goal.currentValue) : 0;
    const progress = target ? Math.round((current / target) * 100) : 0;

    const prompt = `You are a motivational life coach. Help me with my goal:

Goal: ${goal.title}
${goal.description ? `Description: ${goal.description}` : ""}
Category: ${goal.category}
Progress: ${current}${goal.unit ? ` ${goal.unit}` : ""} / ${target ?? "open"}${goal.unit ? ` ${goal.unit}` : ""} (${progress}%)
${goal.dueDate ? `Due: ${goal.dueDate}` : ""}
${milestones.length ? `Milestones: ${milestones.map(m => `${m.title} (${m.isCompleted ? "done" : "pending"})`).join(", ")}` : ""}

Give me 3 specific, actionable steps I can take RIGHT NOW to make progress on this goal. Be encouraging and practical.`;

    const result = await callAi([{ role: "user", content: prompt }], "gpt-4o-mini", 0.7, 512);
    const advice = result.content;
    res.json({ advice });
  } catch { res.status(500).json({ error: "Failed to get coaching" }); }
});

export default router;
