import { apiClient } from "../lib/apiClient.js";

export function postScore(payload, options = {}) {
  return apiClient.request({
    method: "POST",
    path: "/scores",
    data: payload,
    ...options,
  });
}

export function getLeaderboard(params = {}, options = {}) {
  return apiClient.request({
    method: "GET",
    path: "/scores/leaderboard",
    params,
    ...options,
  });
}
