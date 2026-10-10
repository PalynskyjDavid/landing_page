import { NavLink } from "react-router-dom";

export default function TopLink({ to, children, glowOrder = 0 }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      style={{ "--nav-glow-order": glowOrder }}
      className={({ isActive }) => "shell-nav-link" + (isActive ? " is-active" : "")}
    >
      {children}
    </NavLink>
  );
}
