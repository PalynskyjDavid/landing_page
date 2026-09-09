import { apiClient } from "../lib/apiClient.js";

export async function postScore(payload, options = {}) {
  const send = () =>
    apiClient.request({
      method: "POST",
      path: "/scores",
      data: payload,
      ...options,
    });

  try {
    return await send();
  } catch (error) {
    if (error.status !== 400 || error.code !== "score_player_cookie_required") throw error;
    // The first response only issues the HttpOnly cookie; it never inserts a score.
    // Retry once with the SAME payload. If cookies are blocked, the second 400 is
    // a permanent failure rather than an endless identity/retry loop.
    return send();
  }
}

export function getLeaderboard(params = {}, options = {}) {
  return apiClient.request({
    method: "GET",
    path: "/scores/leaderboard",
    params,
    ...options,
  });
}
