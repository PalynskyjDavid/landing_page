import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch {
      // Storage can be blocked; keep the page usable with an in-memory preference.
    }

    // No saved preference -> follow system
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // The selected theme still applies for this visit.
    }
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
