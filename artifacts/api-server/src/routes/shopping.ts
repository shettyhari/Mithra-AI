import { Router } from "express";
import { db } from "@workspace/db";
import { shoppingListsTable, shoppingItemsTable } from "@workspace/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { callAi } from "../lib/ai";

const router = Router();

// ── Lists ──────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const lists = await db.select().from(shoppingListsTable)
      .where(eq(shoppingListsTable.userId, req.userId!))
      .orderBy(desc(shoppingListsTable.updatedAt));

    const enriched = await Promise.all(lists.map(async (list) => {
      const items = await db.select().from(shoppingItemsTable)
        .where(eq(shoppingItemsTable.listId, list.id))
        .orderBy(asc(shoppingItemsTable.sortOrder), asc(shoppingItemsTable.createdAt));
      const total = items.length;
      const checked = items.filter(i => i.isChecked).length;
      return { ...list, items, total, checked };
    }));

    res.json(enriched);
  } catch { res.status(500).json({ error: "Failed to fetch lists" }); }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, emoji, color, isSharedWithFamily } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    const [list] = await db.insert(shoppingListsTable).values({
      userId: req.userId!, title,
      emoji: emoji ?? "🛒",
      color: color ?? "#10b981",
      isSharedWithFamily: isSharedWithFamily ?? false,
    }).returning();
    res.status(201).json({ ...list, items: [], total: 0, checked: 0 });
  } catch { res.status(500).json({ error: "Failed to create list" }); }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, emoji, color, isSharedWithFamily } = req.body;
    const [list] = await db.update(shoppingListsTable)
      .set({ title, emoji, color, isSharedWithFamily, updatedAt: new Date() })
      .where(and(eq(shoppingListsTable.id, id), eq(shoppingListsTable.userId, req.userId!)))
      .returning();
    if (!list) return res.status(404).json({ error: "List not found" });
    res.json(list);
  } catch { res.status(500).json({ error: "Failed to update list" }); }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(shoppingListsTable)
      .where(and(eq(shoppingListsTable.id, id), eq(shoppingListsTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete list" }); }
});

// ── Items ──────────────────────────────────────────────────────────
router.post("/:listId/items", requireAuth, async (req, res) => {
  try {
    const listId = parseInt(req.params.listId);
    const list = await db.select().from(shoppingListsTable)
      .where(and(eq(shoppingListsTable.id, listId), eq(shoppingListsTable.userId, req.userId!)));
    if (!list.length) return res.status(404).json({ error: "List not found" });

    const { name, quantity, category, note, sortOrder } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const [item] = await db.insert(shoppingItemsTable).values({
      listId, userId: req.userId!, name, quantity, category, note,
      sortOrder: sortOrder ?? 0,
    }).returning();

    await db.update(shoppingListsTable).set({ updatedAt: new Date() })
      .where(eq(shoppingListsTable.id, listId));

    res.status(201).json(item);
  } catch { res.status(500).json({ error: "Failed to add item" }); }
});

router.put("/:listId/items/:itemId", requireAuth, async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const listId = parseInt(req.params.listId);
    const { name, quantity, category, note, isChecked, sortOrder } = req.body;

    const updates: Record<string, unknown> = { name, quantity, category, note, sortOrder };
    if (typeof isChecked === "boolean") {
      updates.isChecked = isChecked;
      updates.checkedAt = isChecked ? new Date() : null;
    }

    const [item] = await db.update(shoppingItemsTable)
      .set(updates)
      .where(and(eq(shoppingItemsTable.id, itemId), eq(shoppingItemsTable.userId, req.userId!)))
      .returning();
    if (!item) return res.status(404).json({ error: "Item not found" });

    await db.update(shoppingListsTable).set({ updatedAt: new Date() })
      .where(eq(shoppingListsTable.id, listId));

    res.json(item);
  } catch { res.status(500).json({ error: "Failed to update item" }); }
});

router.delete("/:listId/items/:itemId", requireAuth, async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const listId = parseInt(req.params.listId);
    await db.delete(shoppingItemsTable)
      .where(and(eq(shoppingItemsTable.id, itemId), eq(shoppingItemsTable.userId, req.userId!)));
    await db.update(shoppingListsTable).set({ updatedAt: new Date() })
      .where(eq(shoppingListsTable.id, listId));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete item" }); }
});

// Clear checked items
router.delete("/:listId/items/checked/all", requireAuth, async (req, res) => {
  try {
    const listId = parseInt(req.params.listId);
    const { sql } = await import("drizzle-orm");
    await db.delete(shoppingItemsTable)
      .where(and(eq(shoppingItemsTable.listId, listId), eq(shoppingItemsTable.userId, req.userId!), eq(shoppingItemsTable.isChecked, true)));
    await db.update(shoppingListsTable).set({ updatedAt: new Date() })
      .where(eq(shoppingListsTable.id, listId));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to clear items" }); }
});

// AI suggest items for a list
router.post("/:listId/suggest", requireAuth, async (req, res) => {
  try {
    const listId = parseInt(req.params.listId);
    const items = await db.select().from(shoppingItemsTable)
      .where(eq(shoppingItemsTable.listId, listId));
    const itemNames = items.map(i => i.name).join(", ");
    const { context } = req.body;

    const prompt = `You are a helpful grocery assistant. Based on these existing items in a shopping list: ${itemNames || "none yet"}.
${context ? `Additional context: ${context}` : ""}
Suggest 5-8 additional items that would complement this list. Return ONLY a JSON array of strings, e.g. ["Milk", "Eggs", "Bread"]. No explanation.`;

    const aiResponse = await callAi([{ role: "user", content: prompt }]);
    let suggestions: string[] = [];
    try {
      const match = aiResponse.match(/\[[\s\S]*?\]/);
      if (match) suggestions = JSON.parse(match[0]);
    } catch { suggestions = []; }

    res.json({ suggestions });
  } catch { res.status(500).json({ error: "Failed to get suggestions" }); }
});

export default router;
