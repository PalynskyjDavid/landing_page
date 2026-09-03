import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postScore } from "../api/scores.js";
import { statsKeys } from "./useStatsQuery.js";
import { leaderboardKeys } from "./useLeaderboardQuery.js";

export function useSaveScoreMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postScore,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: statsKeys.all }),
        queryClient.invalidateQueries({ queryKey: leaderboardKeys.all }),
      ]);
    },
  });
}
