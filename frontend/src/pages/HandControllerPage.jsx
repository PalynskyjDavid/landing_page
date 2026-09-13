import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/useI18n.js";
import {
  demoPinchThreshold,
  pinchDemoState,
  handControllerPipeline,
  handControllerContributions,
  handControllerFindings,
} from "./handControllerContent.js";
import "./HandControllerPage.css";

function PinchIllustration({ distance }) {
  const { t } = useI18n();
  const tip = [145 - distance * 1.1, 104 + distance * 0.8];
  const points = [
    [184, 340],
    [147, 310],
    [120, 272],
    [tip[0] - 6, tip[1] + 42],
    tip,
    [144, 238],
    [138, 175],
    [141, 125],
    [145, 87],
    [182, 229],
    [182, 153],
    [183, 98],
    [185, 59],
    [216, 244],
    [226, 173],
    [229, 129],
    [229, 96],
    [245, 267],
    [268, 218],
    [280, 183],
    [286, 153],
  ];
  const chains = [
    [0, 1, 2, 3, 4],
    [0, 5, 6, 7, 8],
    [5, 9, 10, 11, 12],
    [9, 13, 14, 15, 16],
    [13, 17, 18, 19, 20],
    [17, 0],
  ];
  return (
    <svg
      className="hand-illustration"
      viewBox="0 0 360 380"
      role="img"
      aria-label={t("Illustrated hand landmarks")}
    >
      <title>{t("A schematic thumb-index pinch, not a live camera image.")}</title>
      <path className="hand-palm" d="M184 340 L144 238 L182 229 L216 244 L245 267 Z" />
      {chains.map((chain, index) => (
        <polyline key={index} points={chain.map((point) => points[point].join(",")).join(" ")} />
      ))}
      <line
        className="hand-pinch-gap"
        x1={tip[0]}
        y1={tip[1]}
        x2={points[8][0]}
        y2={points[8][1]}
      />
      {points.map(([cx, cy], index) => (
        <circle
          key={index}
          cx={cx}
          cy={cy}
          r={index === 4 || index === 8 ? 7 : 4}
          className={index === 4 || index === 8 ? "hand-tip" : undefined}
        />
      ))}
    </svg>
  );
}

function PinchDemo() {
  const { t } = useI18n();
  const [distance, setDistance] = useState(70);
  const [enabled, setEnabled] = useState(false);
  const [clicks, setClicks] = useState(0);
  const state = pinchDemoState(distance, enabled);
  const message = {
    waiting: "Move the fingertips closer.",
    blocked: "Gesture matches; demo is disarmed.",
    ready: "Gesture matches; demo action is enabled.",
  }[state];
  return (
    <figure className="hand-demo" aria-labelledby="hand-demo-title">
      <div className="hand-demo-heading">
        <h2 id="hand-demo-title">{t("Pinch → Left click")}</h2>
        <span>{t("Illustrated demo")}</span>
      </div>
      <PinchIllustration distance={distance} />
      <div className="hand-demo-controls">
        <div className="hand-range-heading">
          <label htmlFor="hand-demo-distance">{t("Demo pinch distance")}</label>
          <span aria-hidden="true">{distance} / 100</span>
        </div>
        <input
          id="hand-demo-distance"
          type="range"
          min="0"
          max="100"
          value={distance}
          onChange={(event) => setDistance(Number(event.target.value))}
          aria-describedby="hand-demo-scale"
        />
        <p id="hand-demo-scale" className="hand-demo-note">
          {t("Illustrative scale: a value of {{threshold}} or less matches the pinch.", {
            threshold: demoPinchThreshold,
          })}
        </p>
        <p className="hand-demo-state" data-state={state} role="status">
          {t(message)}
        </p>
        <div className="hand-demo-buttons">
          <button
            type="button"
            aria-pressed={enabled}
            onClick={() => setEnabled((value) => !value)}
          >
            {t(enabled ? "Disarm demo" : "Arm demo")}
          </button>
          <button
            type="button"
            disabled={state !== "ready"}
            onClick={() => {
              if (state === "ready") setClicks((value) => value + 1);
            }}
          >
            {t("Preview click")}
          </button>
        </div>
        <p className="hand-demo-count" aria-live="polite" aria-atomic="true">
          {t("Demo clicks: {{count}}", { count: clicks })}
        </p>
      </div>
      <figcaption>
        {t(
          "Only this illustration changes. No camera access, tracking model or operating-system input is used on this page.",
        )}
      </figcaption>
    </figure>
  );
}

export default function HandControllerPage() {
  const { t } = useI18n();
  return (
    <main className="hand-page">
      <Link className="hand-back" to="/">
        ← {t("Back to home")}
      </Link>
      <section className="hand-hero" aria-labelledby="hand-title">
        <div className="hand-intro">
          <p className="hand-eyebrow">{t("Project study / gesture control")}</p>
          <h1 id="hand-title">
            Hand <span>Controller.</span>
          </h1>
          <p className="hand-lead">{t("From a hand movement to a desktop action.")}</p>
          <p>
            {t(
              "A webcam-based desktop prototype that connects configurable hand gestures to mouse and keyboard actions, with profiles and diagnostics for tuning the experience.",
            )}
          </p>
          <a className="hand-action" href="#hand-contribution">
            {t("Explore my contribution")} <span aria-hidden="true">↗︎</span>
          </a>
          <p className="hand-meta">
            {t("Thesis prototype · Windows demonstration · AI-assisted development")}
          </p>
        </div>
        <PinchDemo />
      </section>

      <section className="hand-section" aria-labelledby="hand-pipeline-title">
        <div className="hand-section-heading">
          <span aria-hidden="true">01</span>
          <h2 id="hand-pipeline-title">{t("A gesture is not yet an action")}</h2>
        </div>
        <p className="hand-section-intro">
          {t(
            "Recognition and control are separate decisions. The illustration above simplifies one binding; the desktop application also evaluates timing, priorities and cooldowns.",
          )}
        </p>
        <ol className="hand-pipeline">
          {handControllerPipeline.map((step, index) => (
            <li key={step.title}>
              <span className="hand-step-number" aria-hidden="true">
                0{index + 1}
              </span>
              <h3>{t(step.title)}</h3>
              <p>{t(step.text)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="hand-contribution"
        className="hand-section"
        aria-labelledby="hand-contribution-title"
      >
        <div className="hand-section-heading">
          <span aria-hidden="true">02</span>
          <h2 id="hand-contribution-title">{t("Tech stack / My contribution")}</h2>
        </div>
        <p className="hand-section-intro">
          {t(
            "I developed and evaluated this prototype with AI assistance, focusing on configurable behavior, inspectable diagnostics and practical testing.",
          )}
        </p>
        <div className="hand-contributions">
          {handControllerContributions.map((item) => (
            <article key={item.id} aria-labelledby={"hand-tech-" + item.id}>
              <div>
                <p className="hand-tech-category">{t(item.category)}</p>
                <h3 id={"hand-tech-" + item.id}>{item.name}</h3>
              </div>
              <div>
                <h4>{t(item.title)}</h4>
                <p>{t(item.text)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="hand-section" aria-labelledby="hand-learning-title">
        <div className="hand-section-heading">
          <span aria-hidden="true">03</span>
          <h2 id="hand-learning-title">{t("What testing taught me")}</h2>
        </div>
        <div className="hand-findings">
          {handControllerFindings.map((item) => (
            <article key={item.title}>
              <h3>{t(item.title)}</h3>
              <p>{t(item.text)}</p>
            </article>
          ))}
        </div>
        <aside className="hand-limitations" aria-labelledby="hand-limits-title">
          <h3 id="hand-limits-title">{t("A prototype with clear boundaries")}</h3>
          <p>
            {t(
              "Built for controlled demonstrations and evaluation, not as a general mouse-and-keyboard replacement. Precise gestures and poor camera conditions remain challenging; the Linux VM experiment does not establish full Linux support.",
            )}
          </p>
          <p>
            {t(
              "An earlier Qt/C++ and Python version informed this Rust/Tauri iteration. It is an earlier stage of the same project, not a separate finished product.",
            )}
          </p>
        </aside>
      </section>
      <footer className="hand-footer">
        <p>{t("Make the behavior visible before making it automatic.")}</p>
        <Link to="/projects/flowento">{t("View Flowento project")} ↗︎</Link>
      </footer>
    </main>
  );
}
