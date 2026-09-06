import { GameProvider } from "../providers/ReactionProvider";
import ReactionGame from "../components/ReactionGame";
import ReactionLeaderboard from "../components/ReactionLeaderboard.jsx";
import ScoreDeliveryStatus from "../components/ScoreDeliveryStatus.jsx";
import ConnectionSimulation from "../components/ConnectionSimulation.jsx";

export default function GamePage() {
  return (
    <GameProvider>
      <ConnectionSimulation />
      <ReactionGame />
      <ScoreDeliveryStatus />
      <ReactionLeaderboard />
    </GameProvider>
  );
}
