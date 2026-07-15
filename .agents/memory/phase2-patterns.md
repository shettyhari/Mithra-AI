---
name: Phase 2 patterns
description: Conventions established during Phase 2 feature build (personas, memories, family, shared chats)
---

## New schema tables added (Phase 2)
- `personas` — userId, name, description, systemPrompt, avatarEmoji, isDefault
- `memories` — userId, sourceChatId (nullable), content, category (general|preference|fact|goal|relationship)
- `family_members` — userId, name, relationship (spouse|child|parent|sibling|other), birthday, notes, preferences, avatarUrl
- `chats` — added `shareToken` (nullable text, unique) and `personaId` (nullable int, no FK constraint to avoid circular dep)

## API routes added (Phase 2)
- GET/POST/PUT/DELETE `/api/personas` — personas CRUD
- GET/POST/DELETE `/api/memories` — memories CRUD + bulk delete via `DELETE /api/memories` with `{ids: number[]}`
- GET/POST/PUT/DELETE `/api/family` — family members CRUD
- POST `/api/chats/:id/share` — generates shareToken, returns `{shareToken, shareUrl}`
- DELETE `/api/chats/:id/share` — revokes share
- GET `/api/shared/:token` — public, no auth; returns chat + messages

## Memory/persona injection pattern
`buildEnrichedSystemPrompt(userId, personaId, basePrompt)` in `messages.ts`:
1. If personaId is set, use that persona's systemPrompt (else use base)
2. Append memories grouped by category
3. Append family member context
Both the streaming and non-streaming routes call this before any AI call.

**Why:** Memories and family context must be injected at the system-prompt level so they persist across all messages without cluttering the user-visible conversation.

## zod dependency in api-server
The api-server did NOT have `zod` as a direct dependency (only `@workspace/api-zod`).
Adding new routes that import `zod` directly requires adding `"zod": "catalog:"` to `artifacts/api-server/package.json` and running `pnpm install`.
**Why:** esbuild can bundle zod, but only if it's resolvable from the package's node_modules.

## Memory extraction from chat
Chat page `handleExtractMemories()` — calls the stream endpoint with a special prompt asking the AI to return JSON array of `{content, category}`, then POSTs each to `/api/memories`. The extraction message itself gets saved to the chat; this is acceptable MVP behavior.

## Shared chat public page
`/shared/:token` is NOT wrapped in `ProtectedRoute` — it's a public page that fetches from the unauthenticated `/api/shared/:token` endpoint. Registered directly in App.tsx without AppLayout wrapper.

## Persona selector in chat
Per-request persona override: `selectedPersonaId` state in chat page, passed as `personaId` in the stream body. Backend reads `chat.personaId` (persistent) OR the per-request override (not yet wired — backend only uses `chat.personaId` from DB). Frontend persona selector is for UX only in this MVP; to make it functional, the stream body's personaId would need to be read by the backend route and passed to `buildEnrichedSystemPrompt`.
