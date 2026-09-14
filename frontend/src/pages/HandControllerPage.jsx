import { Link } from "react-router-dom";
import { useI18n } from "../i18n/useI18n.js";
import {
  handControllerPipeline,
  handControllerContributions,
  handControllerFindings,
} from "./handControllerContent.js";
import HandLandmarkDemo from "../components/hand-controller/HandLandmarkDemo.jsx";
import "./HandControllerPage.css";

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
              "A desktop prototype that turns webcam gestures into mouse and keyboard actions, with configurable bindings and profiles.",
            )}
          </p>
          <a className="hand-action" href="#hand-contribution">
            {t("Explore my contribution")} <span aria-hidden="true">↗︎</span>
          </a>
          <p className="hand-meta">{t("Thesis prototype · AI-assisted development")}</p>
        </div>
        <HandLandmarkDemo />
      </section>

      <section className="hand-section" aria-labelledby="hand-pipeline-title">
        <div className="hand-section-heading">
          <span aria-hidden="true">01</span>
          <h2 id="hand-pipeline-title">{t("From camera to action")}</h2>
        </div>
        <p className="hand-section-intro">
          {t(
            "This web demo shows MediaPipe's initial outputs, used to track hands and fingers, their positions and state. The desktop app adds gesture recognition and input control.",
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
          <h3 id="hand-limits-title">{t("Current scope")}</h3>
          <p>
            {t(
              "A Windows prototype for testing gesture control, not a full replacement for a mouse and keyboard.",
            )}
          </p>
        </aside>
      </section>
      <footer className="hand-footer">
        <Link to="/projects/flowento">{t("View Flowento project")} ↗︎</Link>
      </footer>
    </main>
  );
}
