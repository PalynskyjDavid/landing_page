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
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});
