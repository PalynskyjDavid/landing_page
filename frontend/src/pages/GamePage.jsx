import { GameProvider } from "../providers/ReactionProvider";
import ReactionGame from "../components/ReactionGame";
import ReactionLeaderboard from "../components/ReactionLeaderboard.jsx";

export default function GamePage() {
    return (
        <GameProvider>
            <ReactionGame />
            <ReactionLeaderboard />
        </GameProvider>
    );
}
