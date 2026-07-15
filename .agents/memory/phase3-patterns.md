---
name: Phase 3 patterns
description: Schema, routes, and conventions added in Phase 3 (calendar, habits, insights, automations, file AI)
---

## New schema tables (Phase 3)
- `events` — userId, title, startAt, endAt, isAllDay, location, recurrence, color, familyMemberIds (JSON text), reminderMinutes, isSharedWithFamily
- `habits` — userId, title, emoji, color, frequency (daily|weekly), targetDaysPerWeek, isActive, startDate
- `habit_completions` — habitId, userId, completedDate (YYYY-MM-DD text), note
- `automations` — userId, name, triggerType, triggerConfig (JSON text), actionType, actionConfig (JSON text), isActive, lastRunAt, runCount
- `insights` — userId, type, title, content, metadata (JSON text), generatedAt, expiresAt
- `files` table extended: aiSummary, aiKeyPoints (JSON text), aiAnalyzedAt

## New API routes (Phase 3)
All new routes are mounted with explicit prefix in routes/index.ts (not via Express sub-router chaining):
```ts
router.use("/api/events", eventsRouter);
router.use("/api/habits", habitsRouter);
router.use("/api/automations", automationsRouter);
router.use("/api/insights", insightsRouter);
```
- `/api/events` — CRUD + `/upcoming`
- `/api/habits` — CRUD + `/:id/complete` (toggle), `/:id/completions`
- `/api/automations` — CRUD + `/:id/run` (executes action immediately)
- `/api/insights` — `/stats` (aggregate), GET list, `POST /generate` (type + force params)
- `/api/files/:fileId/analyze` — AI analysis, stores to `aiSummary`/`aiKeyPoints`/`aiAnalyzedAt`

## Habit streak computation
`computeStreak(dates: string[])` in habits route:
- Input: array of `YYYY-MM-DD` strings (last 30 days)
- Returns `{ current, longest }`
- If most recent is not today/yesterday, current = 0

## Automation action types
- `send_notification` — inserts into notificationsTable
- `create_task` — inserts into tasksTable
- `ai_summary` — calls `callAi`, sends result as notification
- `chat_message` — calls `callAi`, inserts as assistant message into first user chat

## Insight generation
`POST /api/insights/generate { type, force? }`:
- Checks for existing insight < 24h old (skips if found unless force=true)
- Gathers stats via `gatherStats(userId)` — aggregates counts from chats, messages, tasks, habits, files, events
- Calls `callAi` with type-specific prompt
- Caches result for 7 days in `insights` table

## Frontend pages added
- `/calendar` — monthly grid view, day detail panel, create/edit dialog, color picker
- `/habits` — list with heatmap (30-day), streak badges, toggle-complete per day
- `/insights` — stats cards, RadialBarChart (recharts), generate buttons per type
- `/automations` — templates + full CRUD + "Run Now" button
- `/files` — updated with expandable AI analysis panel per file

## AppLayout nav order (Phase 3)
Chat → Dashboard → Insights → Calendar → Habits → Automations → Personas → Family → Memory → Files → Tasks → Notifications → Settings → [Admin]

## Auth pattern (consistent with Phase 2)
All Phase 3 pages use `authHeaders` helper (same pattern as memories/family/personas):
```ts
const { getToken } = useAuth();
const authHeaders = async (extra?) => {
  const tok = await getToken();
  return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...extra };
};
```
