import { apiClient } from "../lib/apiClient.js";

export function postEvent(payload, options = {}) {
  return apiClient.request({
    method: "POST",
    path: "/events",
    data: payload,
    ...options,
  });
}

export const eventsApi = {
  postEvent,
};
