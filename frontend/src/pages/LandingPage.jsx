import { useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import ProfileCard from "../components/profile/ProfileCard.jsx";
import { useI18n } from "../i18n/useI18n.js";
import { profileName, profileRole } from "../content/profile.js";
import { cvSkills } from "./cvContent.js";
import "./LandingPage.css";

const homeSkills = cvSkills.filter(({ title }) =>
  ["Frontend", "Backend and data", "Testing and tools", "Deployment"].includes(title),
);
const projects = [
  {
    id: "flowento",
    title: "Flowento.",
    context: "Selected project",
    description: "A smart mirror, its web application, and my part in connecting the two.",
    link: "View Flowento project",
    technologies: ["React", "Node.js", "MongoDB"],
  },
  {
    id: "hand-controller",
    title: "Hand Controller.",
    context: "Desktop prototype",
    description:
      "Configurable webcam gestures, desktop actions, and the lessons from testing them.",
    link: "View Hand Controller project",
    technologies: ["Rust", "Tauri", "MediaPipe"],
  },
];

export default function LandingPage() {
  const { t } = useI18n();
  useLayoutEffect(() => {
    // A direct fragment URL can arrive before React mounts its target.
    // Restore it once; subsequent anchor clicks use native smooth scrolling.
    const id = window.location.hash.slice(1);
    if (["about", "skills", "flowento", "hand-controller", "cv", "contact"].includes(id)) {
      document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }, []);
  return (
    <main className="landing-page">
      <section className="home-section home-intro" id="about" aria-labelledby="home-title">
        <p className="profile-eyebrow">
          {profileName} · {t(profileRole)}
        </p>
        <h1 id="home-title">{t("Showcase of projects")}</h1>
        <p className="home-lead">
          {t(
            "Explore projects I've worked on, try interactive demos, and see what I contributed along the way.",
          )}
        </p>
        <div className="profile-actions">
          <Link className="ui-btn ui-surface-inverse" to="/cv">
            {t("Read my CV")}
          </Link>
          <a className="ui-btn" href="#contact">
            {t("Contact")}
          </a>
        </div>
        <nav className="home-section-links" aria-label={t("Selected projects")}>
          <a href="#skills">
            {t("Technical skills")} <span aria-hidden="true">↓</span>
          </a>
          <a href="#flowento">
            Flowento <span aria-hidden="true">↓</span>
          </a>
          <a href="#hand-controller">
            Hand Controller <span aria-hidden="true">↓</span>
          </a>
        </nav>
      </section>

      <section className="home-section" id="skills" aria-labelledby="home-skills-title">
        <h2 id="home-skills-title">{t("Technical skills")}</h2>
        <div className="home-skills">
          {homeSkills.map(({ title, items }) => (
            <div key={title}>
              <h3>{t(title)}</h3>
              <ul className="home-tags">
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {projects.map((project, index) => (
        <section
          className="home-section home-project"
          id={project.id}
          aria-labelledby={`home-${project.id}-title`}
          key={project.id}
        >
          <div className="home-project-number" aria-hidden="true">
            0{index + 1}
          </div>
          <div className="home-project-card">
            <p className="profile-eyebrow">{t(project.context)}</p>
            <h2 id={`home-${project.id}-title`}>{project.title}</h2>
            <p className="home-lead">{t(project.description)}</p>
            <ul className="home-tags">
              {project.technologies.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
            <Link className="ui-btn" to={`/projects/${project.id}`}>
              {t(project.link)}
            </Link>
          </div>
        </section>
      ))}
      <div className="home-section home-profile-block">
        <ProfileCard />
      </div>
    </main>
  );
}
