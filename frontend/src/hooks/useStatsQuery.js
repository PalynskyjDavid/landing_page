import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { statsApi } from "../api/stats.js";

export const statsKeys = {
  all: ["stats"],
  summary: (params = {}) => ["stats", "summary", params],
};

export function useStatsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: statsKeys.summary(params),
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => ({
      ...(await statsApi.getStats(params, { signal })),
      selection: params,
    }),
    ...options,
  });
}
