import { apiClient } from "../lib/apiClient.js";

export function getReadiness(options = {}) {
  return apiClient.request({
    method: "GET",
    path: "/health/ready",
    timeoutMs: 3000,
    ...options,
  });
}
