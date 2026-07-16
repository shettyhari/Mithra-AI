import { Router } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { callAi } from "../lib/ai";
import {
  goalsTable, habitsTable, journalEntriesTable, notesTable,
  shoppingListsTable, shoppingItemsTable, tasksTable,
  eventsTable, budgetTransactionsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// Page route map for navigation commands
const PAGE_MAP: Record<string, string> = {
  chat: "/chat", home: "/chat", messages: "/chat",
  dashboard: "/dashboard", overview: "/dashboard",
  calendar: "/calendar", schedule: "/calendar", events: "/calendar",
  habits: "/habits", habit: "/habits",
  goals: "/goals", goal: "/goals",
  journal: "/journal", diary: "/journal",
  notes: "/notes", note: "/notes",
  shopping: "/shopping", "shopping list": "/shopping", groceries: "/shopping",
  budget: "/budget", finance: "/budget", money: "/budget",
  insights: "/insights", analytics: "/insights", stats: "/insights",
  automations: "/automations", automation: "/automations",
  personas: "/personas", persona: "/personas",
  family: "/family",
  memory: "/memories", memories: "/memories",
  files: "/files", documents: "/files",
  tasks: "/tasks", task: "/tasks", "to do": "/tasks", todo: "/tasks",
  notifications: "/notifications",
  settings: "/settings",
};

router.post("/command", requireAuth, async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) return res.status(400).json({ error: "transcript required" });

    const userId = req.userId!;

    // Gather quick context for the AI
    const [goals, habits, tasks] = await Promise.all([
      db.select({ id: goalsTable.id, title: goalsTable.title, status: goalsTable.status, progress: goalsTable.currentValue })
        .from(goalsTable).where(eq(goalsTable.userId, userId)).orderBy(desc(goalsTable.createdAt)).limit(5),
      db.select({ id: habitsTable.id, title: habitsTable.title })
        .from(habitsTable).where(eq(habitsTable.userId, userId)).limit(5),
      db.select({ id: tasksTable.id, title: tasksTable.title, status: tasksTable.status })
        .from(tasksTable).where(eq(tasksTable.userId, userId)).orderBy(desc(tasksTable.createdAt)).limit(5),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const contextSummary = [
      goals.length ? `Active goals: ${goals.map(g => g.title).join(", ")}` : "",
      habits.length ? `Habits: ${habits.map(h => h.title).join(", ")}` : "",
      tasks.length ? `Recent tasks: ${tasks.map(t => `${t.title} (${t.status})`).join(", ")}` : "",
    ].filter(Boolean).join(". ");

    const pages = Object.keys(PAGE_MAP).filter((k, i, arr) => {
      const v = PAGE_MAP[k];
      return arr.findIndex(kk => PAGE_MAP[kk] === v) === i;
    });

    const systemPrompt = `You are Mithra, a smart AI voice assistant for a family productivity OS.
The user has spoken a voice command. Analyze it and return a JSON action.

Available pages: ${pages.join(", ")}
User context: ${contextSummary || "No context available"}
Today's date: ${today}

Return a JSON object (no markdown, no code blocks) with this exact shape:
{
  "intent": "navigate" | "create_note" | "create_task" | "create_goal" | "add_shopping" | "query" | "journal_entry" | "chat",
  "navigateTo": "/route" (only for navigate intent),
  "title": "string" (for create intents),
  "content": "string" (optional extra content),
  "listName": "string" (for shopping, optional),
  "spoken": "short friendly response to speak aloud (1-2 sentences max)"
}

Examples:
- "go to notes" → { "intent": "navigate", "navigateTo": "/notes", "spoken": "Opening your notes." }
- "add milk to shopping list" → { "intent": "add_shopping", "title": "Milk", "spoken": "Added milk to your shopping list." }
- "create a note about my meeting" → { "intent": "create_note", "title": "Meeting Notes", "spoken": "Creating a new note about your meeting." }
- "what are my goals" → { "intent": "query", "spoken": "You have ${goals.length} active goals: ${goals.map(g => g.title).join(', ')}" }
- "remind me to call doctor" → { "intent": "create_task", "title": "Call doctor", "spoken": "I've added that to your tasks." }
- "write in my journal today was great" → { "intent": "journal_entry", "content": "today was great", "spoken": "Opening your journal to write that down." }
`;

    const rawResponse = await callAi(
      [{ role: "user", content: transcript }],
      "gpt-4o-mini", 0.3, 500, systemPrompt
    );
    const raw = rawResponse.content;

    let action: Record<string, string>;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      action = JSON.parse(match ? match[0] : raw);
    } catch {
      action = { intent: "chat", spoken: raw.slice(0, 300) };
    }

    // Execute side effects for create intents
    if (action.intent === "create_note" && action.title) {
      await db.insert(notesTable).values({
        userId, title: action.title, content: action.content || "",
        color: "#fef3c7", emoji: "📝",
      });
      action.navigateTo = "/notes";
    }

    if (action.intent === "create_task" && action.title) {
      await db.insert(tasksTable).values({
        userId, title: action.title, status: "todo", priority: "medium",
      });
      action.navigateTo = "/tasks";
    }

    if (action.intent === "add_shopping" && action.title) {
      // Find or create first shopping list
      let [list] = await db.select().from(shoppingListsTable)
        .where(eq(shoppingListsTable.userId, userId)).limit(1);
      if (!list) {
        [list] = await db.insert(shoppingListsTable).values({
          userId, title: "Shopping List", emoji: "🛒", color: "#10b981",
        }).returning();
      }
      await db.insert(shoppingItemsTable).values({
        listId: list.id, userId, name: action.title,
      });
      action.navigateTo = "/shopping";
    }

    if (action.intent === "create_goal" && action.title) {
      await db.insert(goalsTable).values({
        userId, title: action.title, emoji: "🎯", color: "#f59e0b",
        category: "personal", currentValue: "0",
      });
      action.navigateTo = "/goals";
    }

    if (action.intent === "journal_entry") {
      action.navigateTo = "/journal";
    }

    if (action.intent === "navigate" && !action.navigateTo) {
      const lower = transcript.toLowerCase();
      for (const [keyword, route] of Object.entries(PAGE_MAP)) {
        if (lower.includes(keyword)) {
          action.navigateTo = route;
          break;
        }
      }
    }

    res.json(action);
  } catch (e) {
    console.error("Voice command error:", e);
    res.status(500).json({ error: "Failed to process command", spoken: "Sorry, I had trouble processing that command." });
  }
});

export default router;
