---
name: Clerk blank screen fixes
description: Two root causes of blank/black screen on Mithra AI, and their fixes.
---

## Root Cause 1 — Missing proxy URL in production bundle

`VITE_CLERK_PROXY_URL` is not injected automatically by Replit's build system (`setupClerkWhitelabelAuth` does NOT set it). Without it, Clerk JS tries to call `clerk.<domain>` directly which doesn't resolve → white blank screen in production.

**Fix:** `artifacts/mithra-ai/vite.config.ts` — derive it at build time from `REPLIT_DOMAINS`:

```ts
const clerkProxyUrl = (() => {
  if (process.env.VITE_CLERK_PROXY_URL) return process.env.VITE_CLERK_PROXY_URL;
  if (process.env.NODE_ENV === 'production' && process.env.REPLIT_DOMAINS) {
    const domain = process.env.REPLIT_DOMAINS.split(',')[0].trim();
    return `https://${domain}/api/__clerk`;
  }
  return '';
})();
// in defineConfig: define: { 'import.meta.env.VITE_CLERK_PROXY_URL': JSON.stringify(clerkProxyUrl) }
```

**Why:** In production builds, Replit sets `REPLIT_DOMAINS` to the live domain. Vite `define` bakes the value in. In dev, it stays empty (correct — dev Clerk doesn't proxy).

## Root Cause 2 — HomeRedirect doesn't handle Clerk loading state

`<Show when="signed-in">` and `<Show when="signed-out">` both render nothing while Clerk is still initializing → black screen (no content, just dark background).

**Fix:** Replace `Show` with explicit `useAuth()` check:

```tsx
function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <PageSpinner />;
  if (isSignedIn) return <Redirect to="/chat" />;
  return <LandingPage />;
}
```

**Why:** `Show` has no loading branch; `useAuth().isLoaded` makes the loading state explicit and shows a spinner until Clerk resolves.
