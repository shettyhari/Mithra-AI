import { Router } from "express";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db";
import { eq, and, desc, like, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { callAi } from "../lib/ai";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { search, tag } = req.query as Record<string, string>;
    let notes = await db.select().from(notesTable)
      .where(eq(notesTable.userId, req.userId!))
      .orderBy(desc(notesTable.isPinned), desc(notesTable.updatedAt));

    if (search) {
      const q = search.toLowerCase();
      notes = notes.filter(n =>
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }

    if (tag) {
      notes = notes.filter(n => {
        if (!n.tags) return false;
        try { return (JSON.parse(n.tags) as string[]).includes(tag); }
        catch { return false; }
      });
    }

    res.json(notes.map(n => ({
      ...n,
      tags: n.tags ? (() => { try { return JSON.parse(n.tags!); } catch { return []; } })() : [],
    })));
  } catch { res.status(500).json({ error: "Failed to fetch notes" }); }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [note] = await db.select().from(notesTable)
      .where(and(eq(notesTable.id, id), eq(notesTable.userId, req.userId!)));
    if (!note) return res.status(404).json({ error: "Note not found" });
    res.json({
      ...note,
      tags: note.tags ? (() => { try { return JSON.parse(note.tags!); } catch { return []; } })() : [],
    });
  } catch { res.status(500).json({ error: "Failed to fetch note" }); }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, content, color, emoji, isPinned, tags } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    const [note] = await db.insert(notesTable).values({
      userId: req.userId!, title, content: content ?? "",
      color: color ?? "#ffffff", emoji: emoji ?? "📝",
      isPinned: isPinned ?? false,
      tags: tags ? JSON.stringify(tags) : null,
    }).returning();
    res.status(201).json({
      ...note,
      tags: note.tags ? JSON.parse(note.tags) : [],
    });
  } catch { res.status(500).json({ error: "Failed to create note" }); }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, content, color, emoji, isPinned, tags } = req.body;
    const [note] = await db.update(notesTable)
      .set({
        title, content, color, emoji, isPinned,
        tags: tags !== undefined ? JSON.stringify(tags) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(notesTable.id, id), eq(notesTable.userId, req.userId!)))
      .returning();
    if (!note) return res.status(404).json({ error: "Note not found" });
    res.json({
      ...note,
      tags: note.tags ? JSON.parse(note.tags) : [],
    });
  } catch { res.status(500).json({ error: "Failed to update note" }); }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(notesTable)
      .where(and(eq(notesTable.id, id), eq(notesTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete note" }); }
});

// Toggle pin
router.patch("/:id/pin", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [note] = await db.select().from(notesTable)
      .where(and(eq(notesTable.id, id), eq(notesTable.userId, req.userId!)));
    if (!note) return res.status(404).json({ error: "Note not found" });

    const [updated] = await db.update(notesTable)
      .set({ isPinned: !note.isPinned, updatedAt: new Date() })
      .where(eq(notesTable.id, id))
      .returning();
    res.json({ ...updated, tags: updated.tags ? JSON.parse(updated.tags) : [] });
  } catch { res.status(500).json({ error: "Failed to toggle pin" }); }
});

// AI summarize
router.post("/:id/summarize", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [note] = await db.select().from(notesTable)
      .where(and(eq(notesTable.id, id), eq(notesTable.userId, req.userId!)));
    if (!note) return res.status(404).json({ error: "Note not found" });
    if (!note.content || note.content.trim().length < 10) {
      return res.status(400).json({ error: "Note content too short to summarize" });
    }

    const prompt = `Summarize the following note in 2-3 concise sentences. Focus on the key points and main takeaways.

Note title: ${note.title}
Note content:
${note.content}

Provide only the summary, no preamble.`;

    const summary = (await callAi([{ role: "user", content: prompt }], "gpt-4o-mini", 0.5, 256)).content;

    const [updated] = await db.update(notesTable)
      .set({ aiSummary: summary, aiSummarizedAt: new Date(), updatedAt: new Date() })
      .where(eq(notesTable.id, id))
      .returning();

    res.json({ summary, note: { ...updated, tags: updated.tags ? JSON.parse(updated.tags) : [] } });
  } catch { res.status(500).json({ error: "Failed to summarize note" }); }
});

// All unique tags for this user
router.get("/meta/tags", requireAuth, async (req, res) => {
  try {
    const notes = await db.select({ tags: notesTable.tags }).from(notesTable)
      .where(eq(notesTable.userId, req.userId!));
    const tagSet = new Set<string>();
    for (const n of notes) {
      if (!n.tags) continue;
      try { (JSON.parse(n.tags) as string[]).forEach(t => tagSet.add(t)); } catch {}
    }
    res.json([...tagSet].sort());
  } catch { res.status(500).json({ error: "Failed to fetch tags" }); }
});

export default router;
