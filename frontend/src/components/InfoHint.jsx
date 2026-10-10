import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./InfoHint.css";

// One small affordance for mouse, keyboard and touch; the explanation never shifts the layout.
export default function InfoHint({ label, children, tone = "neutral", iconOnly = false }) {
  const id = useId();
  const trigger = useRef(null);
  const tooltip = useRef(null);
  const pinned = useRef(false);
  const leaveTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });

  const close = () => {
    clearTimeout(leaveTimer.current);
    pinned.current = false;
    setOpen(false);
  };
  const enter = () => {
    clearTimeout(leaveTimer.current);
    setOpen(true);
  };
  const leave = () => {
    // Allow the pointer to cross the gap and hover the explanation itself.
    leaveTimer.current = setTimeout(() => {
      if (!pinned.current && document.activeElement !== trigger.current) setOpen(false);
    }, 150);
  };

  useEffect(() => () => clearTimeout(leaveTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!trigger.current?.contains(event.target) && !tooltip.current?.contains(event.target)) {
        close();
      }
    };
    const escape = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current.getBoundingClientRect();
      const box = tooltip.current.getBoundingClientRect();
      const below = anchor.bottom + 8;
      setPosition({
        left: Math.max(12, Math.min(anchor.left, window.innerWidth - box.width - 12)),
        top: Math.max(
          12,
          Math.min(
            below + box.height <= window.innerHeight - 12 ? below : anchor.top - box.height - 8,
            window.innerHeight - box.height - 12,
          ),
        ),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, children]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`info-hint is-${tone}${iconOnly ? " is-icon-only" : ""}`}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onFocus={enter}
        onBlur={close}
        onClick={() => {
          pinned.current = !pinned.current;
          setOpen(pinned.current);
        }}
      >
        {!iconOnly && <span>{label}</span>}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 9v5" />
          <circle cx="10" cy="6" r=".6" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={tooltip}
            id={id}
            role="tooltip"
            className="info-hint-tooltip"
            style={position}
            onMouseEnter={enter}
            onMouseLeave={leave}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
