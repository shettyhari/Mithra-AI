# Mithra AI

A premium, private AI operating system for families — each member gets a personal AI chat with configurable providers, plus shared tasks, files, and notifications.

## Run & Operate

- Workflows are already configured and run automatically in the Replit preview:
  - `artifacts/api-server: API Server` — Express API (port 8080, mounted at `/api`)
  - `artifacts/mithra-ai: web` — React/Vite frontend (port 19705, mounted at `/`)
  - `artifacts/mockup-sandbox: Component Preview Server` — design/canvas preview
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (Postgres, already provisioned), `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` (Replit-managed Clerk, already provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: `artifacts/mithra-ai` — React + Vite, Tailwind, shadcn/ui, Framer Motion, Recharts
- API: `artifacts/api-server` — Express 5
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Auth: Clerk (Replit-managed)
- AI: multi-provider (OpenAI, Anthropic, Gemini, Groq) via direct HTTP calls; keys stored per-user in the `ai_keys` table
- Validation: Zod, `drizzle-zod`

## Where things live

- `artifacts/mithra-ai` — frontend app (pages, components, Clerk wiring)
- `artifacts/api-server` — Express API, routes, middlewares
- `lib/db` — Drizzle schema and DB client (`@workspace/db`)

## Product

- Family members sign in via Clerk and get their own AI chat, with per-user model/provider config
- Shared/family features: tasks, file uploads, notifications, global search, admin panel
- "Agent mode" in chat lets the assistant call tools (create task, web search, reminders, plans) via OpenAI function calling

## Gotchas

- Full monorepo `pnpm run typecheck` has some pre-existing type errors in the frontend (see follow-up task) — dev server and app run fine despite these.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
