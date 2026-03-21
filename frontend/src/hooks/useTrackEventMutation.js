import { useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi } from "../api/events.js";
import { statsKeys } from "./useStatsQuery.js";

export function useTrackEventMutation(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, ...mutationOptions } = options;

  return useMutation({
    mutationFn: (payload) => eventsApi.postEvent(payload),
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: statsKeys.all });
      await onSuccess?.(data, variables, context);
    },
  });
}
