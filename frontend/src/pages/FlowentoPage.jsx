import { Link } from "react-router-dom";
import { useI18n } from "../i18n/useI18n.js";
import MirrorViewer from "../components/flowento/MirrorViewer.jsx";
import { flowentoContributions } from "./flowentoContributions.js";
import "./FlowentoPage.css";

export default function FlowentoPage() {
  const { t } = useI18n();
  return (
    <main className="flowento-page">
      <Link className="flowento-back" to="/">
        <span aria-hidden="true">←</span> {t("Back to home")}
      </Link>
      <section className="flowento-hero" aria-labelledby="flowento-title">
        <div className="flowento-intro">
          <p className="flowento-eyebrow">{t("Project study / smart mirror")}</p>
          <h1 id="flowento-title">
            Flowento<span aria-hidden="true">.</span>
          </h1>
          <p className="flowento-lead">{t("An everyday object made smarter.")}</p>
          <p>
            {t(
              "This team project transforms a simple mirror into a configurable everyday helper capable of displaying custom widgets.",
            )}
          </p>
          <a className="flowento-action" href="#contribution">
            {t("Explore my contribution")} <span aria-hidden="true">↗︎</span>
          </a>
          <a
            className="flowento-showcase-link"
            href="https://www.reddit.com/r/MagicMirror/comments/1llfb76/smartmirror_with_fullfeatured_smart_ecosystem_we/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              {t("Mirror showcase on Reddit")}
              <span className="sr-only"> ({t("opens in a new tab")})</span>
            </span>
            <span aria-hidden="true">↗︎</span>
          </a>
          <p className="flowento-small">
            {t("Team project · Full-stack contribution · Interactive prototype")}
          </p>
        </div>
        <MirrorViewer />
      </section>

      <section className="flowento-section" aria-labelledby="flowento-idea">
        <div className="flowento-section-heading">
          <span aria-hidden="true">01</span>
          <h2 id="flowento-idea">{t("More than a reflection")}</h2>
        </div>
        <div className="flowento-feature-grid">
          <article>
            <span className="flowento-feature-symbol" aria-hidden="true">
              ▦
            </span>
            <h3>{t("A personal display")}</h3>
            <p>
              {t(
                "Arrange widgets for information such as weather, calendar events, and tasks on a configurable mirror layout.",
              )}
            </p>
          </article>
          <article>
            <span className="flowento-feature-symbol" aria-hidden="true">
              ⌘
            </span>
            <h3>{t("A connected dashboard")}</h3>
            <p>
              {t(
                "Manage mirrors and their layouts through the web application, and explore the data produced by connected devices such as temperature sensors.",
              )}
            </p>
          </article>
          <article>
            <span className="flowento-feature-symbol" aria-hidden="true">
              ↗︎
            </span>
            <h3>{t("An inspectable system")}</h3>
            <p>
              {t(
                "Audit views, filters, statistics, and exports make the application's activity easier to investigate.",
              )}
            </p>
          </article>
        </div>
      </section>

      <section id="contribution" className="flowento-section" aria-labelledby="flowento-role">
        <div className="flowento-section-heading">
          <span aria-hidden="true">02</span>
          <h2 id="flowento-role">{t("Tech stack / My contribution")}</h2>
        </div>
        <p className="flowento-section-intro">
          {t(
            "I worked across frontend views and backend queries, connecting technical data to tools people could actually use.",
          )}
        </p>
        <div className="flowento-contributions">
          {flowentoContributions.map((technology) => (
            <article key={technology.id} aria-labelledby={"flowento-tech-" + technology.id}>
              <div className="flowento-tech-label">
                <span className="flowento-tech-category">{t(technology.category)}</span>
                <h3 id={"flowento-tech-" + technology.id}>{technology.name}</h3>
                {technology.contextOnly && (
                  <span className="flowento-tech-context">{t("Project context")}</span>
                )}
              </div>
              <div className="flowento-tech-details">
                {technology.details.map((detail) => (
                  <div key={detail.title}>
                    <h4>{t(detail.title)}</h4>
                    <p>{t(detail.description)}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
        <p className="flowento-role-note">
          {t("Flowento was built by a team. My contributions are described per technology.")}
        </p>
      </section>

      <footer className="flowento-footer">
        <p>{t("From the physical frame to the data behind it.")}</p>
        <Link to="/game">{t("Try my reaction game")} ↗︎</Link>
      </footer>
    </main>
  );
}
