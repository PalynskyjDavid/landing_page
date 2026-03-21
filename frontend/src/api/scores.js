import { apiClient } from "../lib/apiClient.js";

export function postScore(payload, options = {}) {
  return apiClient.request({
    method: "POST",
    path: "/scores",
    data: payload,
    ...options,
  });
}
