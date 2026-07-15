---
name: QA fixes — production readiness pass
description: Comprehensive bugs fixed across backend routes and frontend pages in the July 2026 QA pass
---

## callAi signature bug (root cause of all AI endpoint 500s)
`callAi` returns `AiResponse` object `{ content, tokensUsed, model }` — NOT a string.
Every "quick AI" route (shopping suggest, budget advice, journal reflection, goals coaching, notes summarize, automations, insights, files analyze) was:
1. Calling `callAi([msgs])` with wrong arg count (needs `messages, modelId, temp, maxTokens`)
2. Using the return value directly as a string instead of `.content`

**Fix:** All calls changed to `callAi([msgs], "gpt-4o-mini", 0.7, 512).content` pattern.
Files: shopping, budget, journal, goals, notes, automations, insights, files routes.

## Admin route protection was missing
`ProtectedRoute` accepted `adminOnly` prop but never checked it — anyone signed in could access `/admin`.
**Fix:** Added `if (adminOnly && user.publicMetadata?.role !== "admin") return <Redirect to="/dashboard" />`

## Global error handler missing from Express
No `(err, req, res, next)` middleware — unhandled route errors crashed silently.
**Fix:** Added 404 fallthrough + global error handler to `app.ts`.

## date-fns in devDependencies
Used heavily in production pages (calendar, chat, habits, etc.) but listed in devDependencies.
**Fix:** Moved to `dependencies`.

## Error boundary
Created `ErrorBoundary.tsx` component, wrapped all page content in `AppLayout.tsx`.
Pages with explicit error states added: dashboard, tasks, personas, habits, automations.

## Dead code
`VoiceChat.tsx` deleted — replaced by inline voice in chat page.

## Shopping suggest catch
Changed 500 response to graceful `{ suggestions: [] }` so UI degrades cleanly when AI unavailable.
