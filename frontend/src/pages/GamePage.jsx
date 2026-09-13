import { useI18n } from "../i18n/useI18n.js";
import { GameProvider } from "../providers/ReactionProvider";
import ReactionGame from "../components/ReactionGame";
import { Link } from "react-router-dom";
import ScoreDeliveryStatus from "../components/ScoreDeliveryStatus.jsx";
import ConnectionSimulation from "../components/ConnectionSimulation.jsx";

export default function GamePage() {
  const { t } = useI18n();
  return (
    <GameProvider>
      <ConnectionSimulation />
      <ReactionGame />
      <ScoreDeliveryStatus />
      <p className="mx-auto my-6 w-[98%] max-w-[600px] text-center">
        <Link className="ui-btn" to="/statistics">
          {t("View statistics and leaderboard")}
        </Link>
      </p>
    </GameProvider>
  );
}
