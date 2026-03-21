import { useTheme } from "../../hooks/useTheme";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      className="ui-btn ui-surface-inverse"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}