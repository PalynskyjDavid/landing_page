import { createContext, useState, useRef, useMemo, useContext, useEffect } from "react";
import { useSaveScoreMutation } from "../hooks/useSaveScoreMutation.js";

const GameContext = createContext(null);

const MIN_DELAY = 500;
const MAX_DELAY = 5000;

const initialState = {
    TOTAL_ROUNDS: 5,
    phase: "start",
    round: 0,
    times: [],
    misslicks: 0,
    message: "Click to start."
}

// Export to wrap component with provider
export function GameProvider({ children }) {
    const [game, setGame] = useState(initialState);
    const saveScoreMutation = useSaveScoreMutation();
    const postedSummaryRef = useRef(false);

    const startTimeRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        // Runs when component is destroyed
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const setTotalRounds = (count) => {
        setGame(prev => ({ ...prev, TOTAL_ROUNDS: count }));
    }

    const update = (patch) => setGame(prev => ({ ...prev, ...patch }));

    const setTimers = () => {
        if (timerRef.current) clearTimeout(timerRef.current);

        const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);

        timerRef.current = setTimeout(() => {
            startTimeRef.current = performance.now();
            update({ phase: "go", message: "Click!" });
        }, delay);
    };

    const evaluateRound = () => {
        setGame((prev) => {
            const { phase, round, times, misslicks } = prev;

            if (phase === "start" || phase === "summary") {
                setTimers();
                return { ...prev, phase: "wait", round: 1, times: [], misslicks: 0, message: "Wait..." };
            }

            if (phase === "wait") {
                setTimers();
                return { ...prev, misslicks: misslicks + 1, message: "Too soon!" };
            }

            if (phase === "go") {
                const score = Math.round(performance.now() - startTimeRef.current);
                const newTimes = [...times, score];

                if (newTimes.length >= game.TOTAL_ROUNDS) {
                    return { ...prev, phase: "summary", times: newTimes, message: "Finished!" };
                } else {
                    return { ...prev, phase: "result", times: newTimes, message: `Time: ${score}ms. Click for next round.` };
                }
            }

            if (phase === "result") {
                setTimers();
                return { ...prev, phase: "wait", round: round + 1, message: "Wait..." };
            }

            return prev;
        });
    };

    const resetGame = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        setGame(initialState);
    };

    useEffect(() => {
        if (game.phase !== "summary") {
            postedSummaryRef.current = false;
            return;
        }

        if (postedSummaryRef.current) return;
        postedSummaryRef.current = true;

        saveScoreMutation.mutate({
            totalRounds: game.TOTAL_ROUNDS,
            times: game.times,
            missclicks: game.misslicks,
            averageMs: Math.round(game.times.reduce((a, b) => a + b, 0) / game.times.length),
        });
    }, [game, saveScoreMutation]);

    const value = useMemo(() => ({
        game,
        setTotalRounds,
        evaluateRound,
        resetGame,
    }), [game]);

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
    const ctx = useContext(GameContext);
    if (!ctx) throw new Error("useGame must be used inside <GameProvider>!");
    return ctx;
}
