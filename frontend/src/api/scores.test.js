import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../lib/apiClient.js";
import { postScore } from "./scores.js";

vi.mock("../lib/apiClient.js", () => ({ apiClient: { request: vi.fn() } }));

const payload = {
  submissionId: "00000000-0000-4000-8000-000000000001",
  times: [1, 2, 3, 4, 5],
  missclicks: 0,
};
const cookieRequired = { status: 400, code: "score_player_cookie_required" };

describe("score cookie handshake", () => {
  beforeEach(() => vi.resetAllMocks());

  it("replays the same payload once after the cookie-only response", async () => {
    apiClient.request.mockRejectedValueOnce(cookieRequired).mockResolvedValueOnce({ id: 1 });
    await expect(postScore(payload)).resolves.toEqual({ id: 1 });
    expect(apiClient.request).toHaveBeenCalledTimes(2);
    expect(apiClient.request.mock.calls[0]).toEqual(apiClient.request.mock.calls[1]);
    expect(apiClient.request.mock.calls[1][0].data).toBe(payload);
  });

  it("does not loop if the browser cannot retain cookies", async () => {
    apiClient.request.mockRejectedValue(cookieRequired);
    await expect(postScore(payload)).rejects.toBe(cookieRequired);
    expect(apiClient.request).toHaveBeenCalledTimes(2);
  });

  it.each([
    { status: 409, code: "score_submission_conflict" },
    { status: 400, code: "score_invalid_round_count" },
    { status: 503, code: "unavailable" },
  ])("leaves other errors to the delivery policy: $code", async (error) => {
    apiClient.request.mockRejectedValue(error);
    await expect(postScore(payload)).rejects.toBe(error);
    expect(apiClient.request).toHaveBeenCalledOnce();
  });
});
