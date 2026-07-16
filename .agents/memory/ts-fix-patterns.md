---
name: TypeScript fix patterns — Mithra AI monorepo
description: Recurring TS errors and their fixes across lib/db, api-server, and mithra-ai.
---

## drizzle-zod + Zod v3.25.x incompatibility

**Rule:** Schema files in `lib/db/src/schema/` must import from `"zod"` (not `"zod/v4"`), and must NOT use `z.infer<typeof createInsertSchema(...)>` type aliases. Remove both the `z` import and the `export type InsertX = z.infer<...>` lines.

**Why:** `drizzle-zod@0.8.3` returns Zod v3 `ZodObject`. Zod v3.25.x ships v4 as the main `"zod"` export AND a v4 preview as `"zod/v4"`. The v4 `ZodType<any,any,any>` constraint is incompatible with v3 `ZodObject`, causing `z.infer<>` to fail. The `InsertX` type aliases are unused by any route (routes import only table constants).

**How to apply:** Any time a new schema file is added to `lib/db/src/schema/`, do not add `import { z } from "zod"` or `z.infer<>`. Use `typeof table.$inferSelect` and `typeof table.$inferInsert` directly if types are needed.

---

## lib/db must be built before api-server typecheck

**Rule:** Always run `pnpm --filter @workspace/db exec npx tsc --build` before typechecking `artifacts/api-server`. The lib/db package has `composite: true` and generates declaration files in `lib/db/dist/`. Without a fresh build, api-server sees stale declarations and reports "no exported member" for all tables added since last build.

**Why:** TypeScript project references use the compiled `dist/` declarations, not source files directly. The dist/ can lag behind schema additions.

**How to apply:** After any schema change in lib/db, rebuild it before running api-server typecheck.

---

## Express 5 req.params types

**Rule:** In Express 5, `req.params.X` is typed `string | string[]`, not `string`. Any route that passes `req.params.X` to a function expecting `string` (e.g. `parseInt()`, `eq()`) needs `req.params.X as string`.

**Why:** Express 5 broadened the `ParamsDictionary` type from `Record<string,string>` to `Record<string,string|string[]>`.

**How to apply:** Use the regex `req\.params\.([a-zA-Z_]\w*)` → `(req.params.$1 as string)` across all route files.

---

## noImplicitReturns in Express route handlers

**Rule:** Both `artifacts/api-server/tsconfig.json` and `artifacts/mithra-ai/tsconfig.json` need `"noImplicitReturns": false`. The base tsconfig has it `true`, which conflicts with Express route handlers that use early `return res.status(...)` then end without `return`.

---

## SpeechRecognition global type declarations

**Rule:** The SpeechRecognition API is not reliably exposed as a global name in TypeScript's dom lib. Add a custom declaration file (`src/types/speech.d.ts`) declaring `SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent` as global interfaces, and extend `Window` using `new () => SpeechRecognition` (NOT `typeof SpeechRecognition` — that fails because it's a type, not a value constructor).

---

## Generated API hooks require explicit queryKey

**Rule:** Orval-generated hooks (e.g. `useGetMe`, `useGetUnreadNotificationCount`) require `queryKey` in the `query` option object. Import the corresponding `getXQueryKey()` function and pass it explicitly: `{ query: { queryKey: getGetMeQueryKey(), ... } }`.

**Why:** TanStack Query v5 `UseQueryOptions` requires `queryKey`. The generated options builder falls back automatically at runtime, but TypeScript enforces it at compile time.
