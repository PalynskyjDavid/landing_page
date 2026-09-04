import { GameProvider } from "../providers/ReactionProvider";
import ReactionGame from "../components/ReactionGame";
import ReactionLeaderboard from "../components/ReactionLeaderboard.jsx";
import ScoreDeliveryStatus from "../components/ScoreDeliveryStatus.jsx";

export default function GamePage() {
  return (
    <GameProvider>
      <ReactionGame />
      <ScoreDeliveryStatus />
      <ReactionLeaderboard />
    </GameProvider>
  );
}
