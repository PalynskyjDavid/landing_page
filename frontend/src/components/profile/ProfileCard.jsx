import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { cvDownloadName, cvPdfUrl, profileName, profileRole } from "../../content/profile.js";
import ContactLinks from "./ContactLinks.jsx";

export default function ProfileCard() {
  const { t } = useI18n();
  return (
    <div className="home-profile">
      <section id="cv" aria-labelledby="home-cv-title" className="profile-overview">
        <p className="profile-eyebrow">{t("CV")}</p>
        <h2 id="home-cv-title">{profileName}</h2>
        <p className="profile-role">{t(profileRole)}</p>
        <div className="profile-actions">
          <Link className="ui-btn ui-surface-inverse" to="/cv">
            {t("Read my CV")}
          </Link>
          <a className="ui-btn" href={cvPdfUrl} download={cvDownloadName}>
            {t("Download PDF (EN)")}
          </a>
        </div>
      </section>
      <section id="contact" aria-labelledby="home-contact-title" className="profile-contact">
        <h2 id="home-contact-title">{t("Contact")}</h2>
        <p>{t("Have a role or project in mind? Get in touch.")}</p>
        <ContactLinks />
      </section>
    </div>
  );
}
