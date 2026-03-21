import { GameProvider } from "../providers/ReactionProvider";
import ReactionGame from "../components/ReactionGame";

export default function GamePage() {
    return (
        <GameProvider>
            <ReactionGame />
        </GameProvider>
    );
}
