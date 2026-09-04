import { createContext, useContext } from "react";

export const ScoreDeliveryContext = createContext(null);

export function useScoreDelivery() {
  const context = useContext(ScoreDeliveryContext);

  if (!context) {
    throw new Error("useScoreDelivery must be used inside <ScoreDeliveryProvider>.");
  }

  return context;
}
