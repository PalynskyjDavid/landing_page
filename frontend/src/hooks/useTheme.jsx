import { useEffect, useState } from "react";

export function useTheme() {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem("theme");
        if (saved === "dark" || saved === "light") return saved;

        // No saved preference -> follow system
        return window.matchMedia("(prefers-color-scheme: dark)").matches 
        ? "dark" 
        : "light";
    });

    useEffect(() => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        localStorage.setItem("theme", theme);
    }, [theme]);

    // // Optional: if user never picked a theme, keep following system changes
    // useEffect(() => {
    //     const saved = localStorage.getItem("theme");
    //     if (saved) return; // user chose manually

    //     const mq = window.matchMedia("(prefers-color-scheme: dark)");
    //     const onChange = (e) => {
    //         document.documentElement.classList.toggle("dark", e.matches);
    //     };

    //     mq.addEventListener?.("change", onChange);
    //     return () => mq.removeEventListener?.("change", onChange);
    // }, []);

    return { theme, setTheme };
}