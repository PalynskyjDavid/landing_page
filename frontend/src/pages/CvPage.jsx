import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/useI18n.js";
import { cvDownloadName, cvPdfUrl, profileName, profileRole } from "../content/profile.js";
import { cvProfile, cvSkills, cvProjects, cvEducation, cvLanguages } from "./cvContent.js";
import ContactLinks from "../components/profile/ContactLinks.jsx";
import "./CvPage.css";

export default function CvPage() {
  const { t } = useI18n();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);
  return (
    <main className="cv-page">
      <Link className="cv-back" to="/">
        ← {t("Back to home")}
      </Link>
      <header className="cv-intro">
        <div>
          <p className="profile-eyebrow">{t("CV")}</p>
          <h1>{profileName}</h1>
          <p className="profile-role">{t(profileRole)}</p>
        </div>
        <div className="profile-actions">
          <a className="ui-btn ui-surface-inverse" href={cvPdfUrl} download={cvDownloadName}>
            {t("Download PDF (EN)")}
          </a>
          <a className="ui-btn" href={cvPdfUrl} target="_blank" rel="noopener noreferrer">
            {t("Open original PDF")} ↗<span className="sr-only"> ({t("opens in a new tab")})</span>
          </a>
        </div>
      </header>
      <nav className="cv-sections" aria-label={t("CV sections")}>
        {[
          ["profile", "Profile"],
          ["skills", "Technical skills"],
          ["projects", "Selected projects"],
          ["education", "Education"],
          ["languages", "Spoken languages"],
        ].map(([id, label]) => (
          <a key={id} href={"#cv-" + id}>
            {t(label)}
          </a>
        ))}
      </nav>
      <section className="cv-section" id="cv-profile" aria-labelledby="cv-profile-title">
        <h2 id="cv-profile-title">{t("Profile")}</h2>
        <p>{t(cvProfile)}</p>
        <ContactLinks />
      </section>
      <section className="cv-section" id="cv-skills" aria-labelledby="cv-skills-title">
        <h2 id="cv-skills-title">{t("Technical skills")}</h2>
        <div className="cv-skills">
          {cvSkills.map(({ title, items, note }) => (
            <section key={title} aria-label={t(title)}>
              <h3>{t(title)}</h3>
              <ul className="cv-tags">
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {note && <p className="profile-note">{t(note)}</p>}
            </section>
          ))}
        </div>
      </section>
      <section className="cv-section" id="cv-projects" aria-labelledby="cv-projects-title">
        <h2 id="cv-projects-title">{t("Selected projects")}</h2>
        <div className="cv-projects">
          {cvProjects.map((project) => (
            <article key={project.title}>
              <h3>
                <Link to={project.route}>{t(project.title)}</Link>
              </h3>
              <p className="profile-note">{t(project.context)}</p>
              <ul className="cv-tags">
                {project.technologies.map((tech) => (
                  <li key={tech}>{tech}</li>
                ))}
              </ul>
              {project.note && <p className="profile-note">{t(project.note)}</p>}
              <ul className="cv-points">
                {project.points.map((point) => (
                  <li key={point}>{t(point)}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <section className="cv-section" id="cv-education" aria-labelledby="cv-education-title">
        <h2 id="cv-education-title">{t("Education")}</h2>
        <ul className="cv-education">
          {cvEducation.map(({ school, program, period }) => (
            <li key={school + period}>
              <div>
                <h3>{school}</h3>
                <p>{t(program)}</p>
              </div>
              <span>{t(period)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="cv-section" id="cv-languages" aria-labelledby="cv-languages-title">
        <h2 id="cv-languages-title">{t("Spoken languages")}</h2>
        <ul className="cv-tags">
          {cvLanguages.map((language) => (
            <li key={language}>{t(language)}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
