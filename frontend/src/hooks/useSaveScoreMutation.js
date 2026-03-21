import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postScore } from "../api/scores.js";
import { statsKeys } from "./useStatsQuery.js";

export function useSaveScoreMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postScore,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: statsKeys.all });
    },
  });
}
