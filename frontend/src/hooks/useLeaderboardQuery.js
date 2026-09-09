import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "../api/scores.js";

export const leaderboardKeys = {
  all: ["scores", "leaderboard"],
  list: (limit, sort) => ["scores", "leaderboard", { limit, sort }],
};

export function useLeaderboardQuery(
  limit = 10,
  sort = [
    { field: "averageMs", direction: "best" },
    { field: "missclicks", direction: "best" },
  ],
) {
  return useQuery({
    queryKey: leaderboardKeys.list(limit, sort),
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      getLeaderboard(
        {
          limit,
          sort: sort.map((selection) => `${selection.field}:${selection.direction}`).join(","),
        },
        { signal },
      ),
  });
}
