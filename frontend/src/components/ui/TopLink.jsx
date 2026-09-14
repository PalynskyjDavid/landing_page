import { NavLink } from "react-router-dom";

export default function TopLink({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) => "shell-nav-link" + (isActive ? " is-active" : "")}
    >
      {children}
    </NavLink>
  );
}
