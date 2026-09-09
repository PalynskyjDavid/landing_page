import { QueryClient } from "@tanstack/react-query";
import { isRetryableError } from "./apiClient.js";

function shouldRetry(failureCount, error) {
  return failureCount < 3 && isRetryableError(error);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      retry: shouldRetry,
      retryDelay: (attempt, error) =>
        Math.min(
          2147483647,
          Math.max(error?.retryAfterMs ?? 0, Math.min(1000 * 2 ** attempt, 30000)),
        ),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});
