import { apiClient } from "../lib/apiClient.js";

export function getStats(params = {}, options = {}) {
  return apiClient.request({
    method: "GET",
    path: "/stats/summary",
    params,
    ...options,
  });
}

export const statsApi = {
  getStats,
};
