---
name: Phase 4 patterns
description: Schema, routes, and conventions for Phase 4 features (shopping, budget, journal, goals, notes)
---

## CRITICAL: Route mounting prefix bug
app.ts mounts all routes at `/api`: `app.use("/api", router)`.
Express strips the `/api` prefix before passing to the router.
So routes inside router/index.ts must NOT include `/api`:
- CORRECT: `router.use("/shopping", shoppingRouter)`
- WRONG: `router.use("/api/shopping", shoppingRouter)` → resolves to `/api/api/shopping`

**Why:** Phase 3 routes had this bug too (`/api/habits` etc in the router) — they appeared to work in some sessions but actually returned 404 when tested with curl. Phase 4 discovered and fixed it for all routes.

**How to apply:** Whenever adding a new router to routes/index.ts, use path WITHOUT `/api` prefix. The frontend still calls `fetch(\`${BASE}/api/shopping\`)` — this is correct and hits Express at `/api/shopping`, which is handled by the router at `/shopping`.

## New schema tables (Phase 4)
- `shopping_lists` — userId, title, emoji, color, isSharedWithFamily
- `shopping_items` — listId, userId, name, quantity, category, note, isChecked, sortOrder
- `budget_categories` — userId, name, emoji, color, type (income|expense), monthlyBudget
- `budget_transactions` — userId, categoryId, title, amount (numeric), type, date (YYYY-MM-DD), isRecurring
- `journal_entries` — userId, date (YYYY-MM-DD), title, content, mood (1-5), moodLabel, tags (JSON text), aiReflection
- `goals` — userId, title, description, emoji, color, category, status, targetValue, currentValue (numeric), unit, dueDate, isSharedWithFamily
- `goal_milestones` — goalId, userId, title, targetValue, isCompleted, dueDate, sortOrder
- `notes` — userId, title, content, color, emoji, isPinned, tags (JSON text), aiSummary

## New API routes (Phase 4)
All registered in routes/index.ts WITHOUT `/api` prefix:
- `router.use("/shopping", shoppingRouter)` — lists CRUD + items CRUD + POST /listId/suggest (AI) + DELETE /listId/items/checked/all
- `router.use("/budget", budgetRouter)` — /categories CRUD, /transactions CRUD, /summary (stats), /ai-advice (POST)
- `router.use("/journal", journalRouter)` — CRUD + POST /:id/reflect (AI) + GET /stats/mood
- `router.use("/goals", goalsRouter)` — CRUD + PATCH /:id/progress + POST /:id/milestones + PATCH /:id/milestones/:mid + POST /:id/coach (AI)
- `router.use("/notes", notesRouter)` — CRUD + PATCH /:id/pin + POST /:id/summarize (AI) + GET /meta/tags

## Frontend pages (Phase 4)
- `/shopping` — collapsible lists with progress bars, inline add-item, AI suggest button with chip suggestions
- `/budget` — 3-tab (overview/transactions/categories), area chart (recharts), category budget bars, AI advice panel
- `/journal` — 30-day mood heatmap, streak/avg-mood stats, editor dialog with mood picker + AI reflection panel
- `/goals` — status filter tabs, progress bars, milestone checklist, inline progress update, AI coach panel
- `/notes` — masonry-style grid, color-coded cards, pin toggle, search + tag filter, AI summarize button

## Nav items added (Phase 4)
After Habits: Goals (Flag), Journal (BookOpen), Notes (StickyNote), Shopping (ShoppingCart), Budget (DollarSign)
Lucide icons imported: ShoppingCart, DollarSign, BookOpen, Flag, StickyNote

## Journal duplicate-date handling
`POST /api/journal` returns 409 with `{ error, id }` if an entry already exists for that date.
Frontend `openNew()` checks existing entries for today and opens the existing one if found — avoids the 409.
