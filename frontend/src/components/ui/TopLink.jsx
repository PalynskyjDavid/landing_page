import { NavLink } from "react-router-dom";
import clsx from "clsx";

export default function TopLink({ to, children, tilt = "right" }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                clsx(
                    "ladder-link",
                    tilt === "right" ? "ladder-tilt-right" : "ladder-tilt-left",
                    isActive && "is-active"
                )
            }
        >
            <span className="ladder-link-text">{children}</span>
            <span className="ladder-link-underline" />
        </NavLink>
    );
}