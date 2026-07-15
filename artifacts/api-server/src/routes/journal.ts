import { Router } from "express";
import { db } from "@workspace/db";
import { journalEntriesTable } from "@workspace/db";
import { eq, and, gte, lte, desc, like } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { callAi } from "../lib/ai";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { start, end, search } = req.query as Record<string, string>;
    const conditions = [eq(journalEntriesTable.userId, req.userId!)];
    if (start) conditions.push(gte(journalEntriesTable.date, start));
    if (end) conditions.push(lte(journalEntriesTable.date, end));

    const entries = await db.select().from(journalEntriesTable)
      .where(and(...conditions))
      .orderBy(desc(journalEntriesTable.date));

    // Filter by search in memory (simple approach)
    const filtered = search
      ? entries.filter(e =>
          e.content.toLowerCase().includes(search.toLowerCase()) ||
          e.title?.toLowerCase().includes(search.toLowerCase()))
      : entries;

    res.json(filtered);
  } catch { res.status(500).json({ error: "Failed to fetch journal entries" }); }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [entry] = await db.select().from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, req.userId!)));
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json(entry);
  } catch { res.status(500).json({ error: "Failed to fetch entry" }); }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { date, title, content, mood, moodLabel, tags } = req.body;
    if (!content) return res.status(400).json({ error: "content required" });
    const today = new Date().toISOString().slice(0, 10);

    // Check for duplicate date
    const existing = await db.select().from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.userId, req.userId!), eq(journalEntriesTable.date, date ?? today)));
    if (existing.length) return res.status(409).json({ error: "Entry for this date already exists", id: existing[0].id });

    const [entry] = await db.insert(journalEntriesTable).values({
      userId: req.userId!, date: date ?? today, title, content,
      mood: mood ?? null, moodLabel: moodLabel ?? null,
      tags: tags ? JSON.stringify(tags) : null,
    }).returning();
    res.status(201).json(entry);
  } catch (e: any) {
    if (e.message?.includes("Entry for this date")) return res.status(409).json({ error: e.message });
    res.status(500).json({ error: "Failed to create entry" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, content, mood, moodLabel, tags } = req.body;
    const [entry] = await db.update(journalEntriesTable)
      .set({
        title, content, mood, moodLabel,
        tags: tags ? JSON.stringify(tags) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, req.userId!)))
      .returning();
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json(entry);
  } catch { res.status(500).json({ error: "Failed to update entry" }); }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete entry" }); }
});

// AI Reflection
router.post("/:id/reflect", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [entry] = await db.select().from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, req.userId!)));
    if (!entry) return res.status(404).json({ error: "Entry not found" });

    const moodContext = entry.moodLabel ? `Mood: ${entry.moodLabel} (${entry.mood}/5)` : "";
    const prompt = `You are a compassionate AI journaling coach. Read this journal entry and provide a thoughtful, empathetic reflection.

Date: ${entry.date}
${moodContext}
${entry.title ? `Title: ${entry.title}` : ""}

Entry:
${entry.content}

Write a warm, insightful reflection (3-4 sentences) that:
1. Acknowledges the writer's feelings and experiences
2. Points out patterns or insights they may not have noticed
3. Offers gentle encouragement or a positive perspective
Keep it personal and supportive, not generic.`;

    const reflection = await callAi([{ role: "user", content: prompt }]);

    const [updated] = await db.update(journalEntriesTable)
      .set({ aiReflection: reflection, aiReflectedAt: new Date(), updatedAt: new Date() })
      .where(eq(journalEntriesTable.id, id))
      .returning();

    res.json({ reflection, entry: updated });
  } catch { res.status(500).json({ error: "Failed to generate reflection" }); }
});

// Mood stats
router.get("/stats/mood", requireAuth, async (req, res) => {
  try {
    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const entries = await db.select().from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.userId, req.userId!), gte(journalEntriesTable.date, thirtyAgo)))
      .orderBy(journalEntriesTable.date);

    const withMood = entries.filter(e => e.mood !== null);
    const avgMood = withMood.length
      ? withMood.reduce((s, e) => s + (e.mood ?? 0), 0) / withMood.length
      : null;

    const moodByDay = entries.map(e => ({ date: e.date, mood: e.mood, label: e.moodLabel }));
    const streak = computeStreak(entries.map(e => e.date));

    res.json({ total: entries.length, avgMood, streak, moodByDay });
  } catch { res.status(500).json({ error: "Failed to fetch mood stats" }); }
});

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

export default router;
