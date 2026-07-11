import { QueryClient } from '@tanstack/react-query';

// Base URL for API calls — Vite's BASE_URL includes trailing slash, strip it
export const BASE_URL = (import.meta.env.BASE_URL as string).replace(/\/$/, "") + "/";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});