import { useGame } from "../providers/ReactionProvider";

function Card({ children, className = "", style = {} }) {
    const baseStyle = {
        boxShadow: "4px 4px 15px 2px rgb(var(--fg))",
        display: "flex",
        flexDirection: "column",
        alignItems: "center", //default y-axis, here for column y-axis
        width: "98%",
        maxWidth: "600px",
        border: "2px solid rgb(var(--fg))",
        borderRadius: "12px",
        backgoundColor: "red"
    };

    return (
        <div
            //Pisitioning agains other elements around
            className={`mx-auto my-[2dvh] ${className}`}
            //Styling of insides, overrides className if needed.
            style={{ ...baseStyle, ...style }}
        >
            {children}
        </div>
    );
}

export default function ReactionGame() {
    const {
        game,
        setTotalRounds,
        evaluateRound,
        resetGame,
    } = useGame();

    const bgColor = game.phase === "go" ? "#00ff0472" : game.phase === "wait" ? "#ff000032" : "#ffffff00";
    const pulseStyle = game.phase === "go" ? {
        cursor: 'pointer'
    } : {};


    if (game.phase === "summary") {
        return (
            <div className="summary-screen">
                stats
            </div>
        )

    }

    return (
        <Card
            className={game.phase === "go" ? "pulse" : ""}
            style={{
                backgroundColor: bgColor,
                ...pulseStyle
            }}
        >
            <div
                style={{
                    height: "45px",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center", //y axis
                    justifyContent: "space-evenly" //x-axis
                }}>
                {game.round != 0 ?
                    <>
                        <p>
                            Round {game.round} / {game.TOTAL_ROUNDS}
                        </p>
                        <button
                            className="ui-btn ui-surface-inverse ml-5"
                            onClick={resetGame}>
                            Restart
                        </button>
                    </>
                    :
                    ("Click only when green appears.")}
            </div>

            <div
                className="w-full h-40 flex flex-grow items-center justify-center"
                onMouseDown={evaluateRound}>
                {game.message}
            </div>

        </Card>
    )
}