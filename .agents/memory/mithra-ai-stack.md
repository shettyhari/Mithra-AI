---
name: Mithra AI Stack
description: Architecture decisions, key patterns, and known quirks for the Mithra AI project
---

## Stack
- Frontend: `artifacts/mithra-ai` — React + Vite, Tailwind, shadcn/ui, Framer Motion, Recharts
- Backend: `artifacts/api-server` — Express, Drizzle ORM, PostgreSQL
- Auth: Clerk (Replit-managed). Keys in CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY
- AI: Multi-provider (OpenAI, Anthropic, Gemini, Groq) via direct HTTP calls; keys stored in `ai_keys` table (base64 "encrypted")

## DB schema
Tables: users, user_settings, chats, messages, files, tasks, notifications, ai_config, ai_keys, audit_logs
- First user to sign up becomes admin (JIT provisioned in `requireAuth` middleware)
- `ai_config` with `userId = null` = global default config

## Advanced features added
- **ThemeProvider** (`src/lib/theme.tsx`): dark/light toggle, persisted in localStorage, applies `.dark` to `document.documentElement`
- **ThemeToggle** (`src/components/ThemeToggle.tsx`): pill-style toggle, used in sidebar header + mobile header
- **GlobalSearch** (`src/components/GlobalSearch.tsx`): Cmd+K modal, searches chats/files/tasks/messages + LLM answer via `POST /api/search`; listens to `mithra-search-open` custom event
- **Agent mode**: toggle in chat header; `agentMode` bool passed in request body (outside Zod schema); backend executes OpenAI function-calling loop (max 3 iters) with tools: create_task, web_search, create_reminder, analyze_and_summarize, generate_plan
- **`BASE_URL`** exported from `src/lib/queryClient.ts` for use in raw fetch calls
- **Markdown + syntax highlighting** in chat: react-markdown + remark-gfm + react-syntax-highlighter (prism)

## API client hook naming
Generated hooks follow: `useGetFoo` / `getGetFooQueryKey` (note double "Get").
Design subagent may use shortened names like `getUserSettingsQueryKey` — must be `getGetUserSettingsQueryKey`.

## Clerk patterns
- `publishableKeyFromHost` from `@clerk/react/internal` in frontend
- Clerk proxy path mounted before body parsers in `app.ts`
- `useToast` must be imported from `@/hooks/use-toast`, NOT from `@/components/ui/toast`
- `CheckAll` does not exist in lucide-react; use `CheckCheck` instead

**Why:** Documented to avoid repeated fixes when design subagents regenerate pages.
