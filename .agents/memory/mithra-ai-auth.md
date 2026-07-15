---
name: Mithra AI Auth Pattern
description: How auth tokens reach every API call — generated client vs raw fetch
---

## The Pattern

The app uses TWO auth mechanisms that must both be set up:

### 1. Generated API client (TanStack Query hooks from @workspace/api-client-react)
Uses `customFetch` internally. Requires two calls at startup:

```ts
// In queryClient.ts (module level — safe, no React hook):
import { setBaseUrl } from '@workspace/api-client-react';
setBaseUrl(BASE_URL.replace(/\/$/, "")); // e.g. "/mithra-ai"

// In App.tsx — inside ClerkProvider, as a component:
function AuthTokenRegistrar() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(getToken);
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}
// Render <AuthTokenRegistrar /> inside QueryClientProvider inside ClerkProvider
```

**Why:** `setBaseUrl` prepends the Vite BASE_URL so `/api/...` → `/mithra-ai/api/...` which the Replit proxy routes to the API server. `setAuthTokenGetter` injects `Authorization: Bearer <token>` on every generated-client fetch.

### 2. Raw fetch calls (pages that don't use generated hooks)
Pages: `memories.tsx`, `family.tsx`, `personas.tsx`, `chat/[id].tsx`

Pattern:
```ts
const { getToken } = useAuth();
const authHeaders = async (extra?: Record<string, string>) => {
  const tok = await getToken();
  return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...extra };
};
// Then: headers: await authHeaders({ "Content-Type": "application/json" })
```

**Why:** These pages bypass the generated client, so setAuthTokenGetter doesn't help them.

## Body Size Limit
Express body parser must be 20mb+ to handle base64 image attachments in chat:
```ts
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
```
Default 100kb limit causes 413 on the `/messages/stream` endpoint when images are attached.

## Key files
- `artifacts/mithra-ai/src/lib/queryClient.ts` — setBaseUrl call
- `artifacts/mithra-ai/src/App.tsx` — AuthTokenRegistrar component
- `artifacts/api-server/src/app.ts` — body limit config
