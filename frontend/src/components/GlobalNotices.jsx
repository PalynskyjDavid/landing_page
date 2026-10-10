import { useLayoutEffect, useRef } from "react";
import { ConnectionSimulationBanner } from "./ConnectionSimulation.jsx";
import ScoreDeliveryNotifications from "./ScoreDeliveryNotifications.jsx";
import "./GlobalNotices.css";

export default function GlobalNotices() {
  const stack = useRef(null);
  useLayoutEffect(() => {
    // Extra space is only added after page content, never above it. This keeps
    // the final controls reachable behind the fixed notices without moving them.
    const update = () =>
      document.documentElement.style.setProperty(
        "--mobile-notice-height",
        `${Math.ceil(stack.current.getBoundingClientRect().height)}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(stack.current);
    update();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--mobile-notice-height");
    };
  }, []);
  return (
    <div className="app-notices" ref={stack}>
      <ConnectionSimulationBanner />
      <ScoreDeliveryNotifications />
    </div>
  );
}
