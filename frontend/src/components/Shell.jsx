import { useI18n } from "../i18n/useI18n.js";
import LanguageSwitcher from "./ui/LanguageSwitcher.jsx";
import { Outlet } from "react-router-dom";
import ThemeSwitch from "../components/ui/ThemeToggleBtn";
import TopLink from "../components/ui/TopLink";

// function cx(...classes) {
//     return classes.filter(Boolean).join(" ");
// }
//     useEffect(() => {
//         document.documentElement.classList.toggle("dark", theme === "dark");
//         localStorage.setItem("theme", theme);
//     }, [theme]);

//     return { theme, setTheme };
// }

// function Container({ children, className }) {
//     return <div className={cx("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
// }

// function Button({ children, variant = "primary", className, ...props }) {
//     const styles =
//         variant === "primary"
//             ? "bg-[rgb(var(--primary))] text-[rgb(var(--primary-fg))] hover:opacity-90"
//             : "bg-[rgb(var(--card))] text-[rgb(var(--fg))] border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))]";

//     return (
//         <button
//             className={cx(
//                 "inline-flex items-center justify-center gap-2 px-4 py-2",
//                 "rounded-[var(--radius)] transition active:scale-[0.99]",
//                 "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ring))] focus:ring-offset-2 focus:ring-offset-[rgb(var(--bg))]",
//                 styles,
//                 className
//             )}
//             {...props}
//         >
//             {children}
//         </button>
//     );
// }

// function TopLink({ to, children }) {
//     return (
//         <NavLink
//             to={to}
//             className={({ isActive }) =>
//                 cx(
//                     "ladder-nav-link",
//                     "text-[var(--fs-sm)] transition",
//                     isActive ? "active" : ""
//                 )
//             }
//         >
//             <span>{children}</span>
//         </NavLink>
//     );
// }

export default function Shell() {
  const { t } = useI18n();
  // const { theme, setTheme } = useTheme();
  // const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="shell-div">
      <header className="shell-header">
        <div className="shell-controls">
          <ThemeSwitch />
          <LanguageSwitcher />
        </div>

        <nav className="shell-nav">
          <TopLink to="/" tilt="left">
            {t("Home")}
          </TopLink>
          <TopLink to="/game" tilt="right">
            {t("Game")}
          </TopLink>
          <TopLink to="/statistics" tilt="left">
            {t("Statistics")}
          </TopLink>
        </nav>
      </header>

      <Outlet />

      <footer></footer>
    </div>
  );
}
