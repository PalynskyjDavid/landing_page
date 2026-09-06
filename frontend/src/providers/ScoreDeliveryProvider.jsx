import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { leaderboardKeys } from "../hooks/useLeaderboardQuery.js";
import { statsKeys } from "../hooks/useStatsQuery.js";
import { scoreDelivery } from "../services/scoreDelivery.js";
import { connectionSimulation } from "../lib/connectionSimulation.js";
import { ScoreDeliveryContext } from "./scoreDeliveryContext.js";

export function ScoreDeliveryProvider({ children }) {
  const queryClient = useQueryClient();
  const snapshot = useSyncExternalStore(
    scoreDelivery.subscribe,
    scoreDelivery.getSnapshot,
    scoreDelivery.getSnapshot,
  );

  useEffect(() => {
    const unsubscribeSimulation = connectionSimulation.subscribe(() => {
      if (!connectionSimulation.getSnapshot().enabled) {
        void scoreDelivery.retryNow();
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: statsKeys.all }),
          queryClient.invalidateQueries({ queryKey: leaderboardKeys.all }),
        ]);
      }
    });
    const unsubscribe = scoreDelivery.onDelivered(() => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: statsKeys.all }),
        queryClient.invalidateQueries({ queryKey: leaderboardKeys.all }),
      ]);
    });

    void scoreDelivery.start();
    return () => {
      unsubscribeSimulation();
      unsubscribe();
      scoreDelivery.stop();
    };
  }, [queryClient]);

  const value = useMemo(
    () => ({
      ...snapshot,
      submitScore: scoreDelivery.submit,
      retryNow: scoreDelivery.retryNow,
    }),
    [snapshot],
  );

  return <ScoreDeliveryContext.Provider value={value}>{children}</ScoreDeliveryContext.Provider>;
}
