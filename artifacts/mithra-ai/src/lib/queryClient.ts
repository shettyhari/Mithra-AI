import { QueryClient } from '@tanstack/react-query';
import { setBaseUrl } from '@workspace/api-client-react';

// Base URL for API calls — Vite's BASE_URL includes trailing slash, strip it
export const BASE_URL = (import.meta.env.BASE_URL as string).replace(/\/$/, "") + "/";

// Register the base URL with the generated API client so all generated hooks
// prepend the correct path (e.g. /mithra-ai/api/chats instead of /api/chats)
setBaseUrl(BASE_URL.replace(/\/$/, ""));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});