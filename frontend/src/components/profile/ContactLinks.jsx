import { useI18n } from "../../i18n/useI18n.js";
import { contactLinks } from "../../content/profile.js";
import "./profile.css";

function SocialIcon({ name }) {
  return (
    <svg
      className="contact-social-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {name === "github" ? (
        <path d="M12 .5a11.5 11.5 0 0 0-3.637 22.409c.575.106.785-.25.785-.554 0-.273-.01-.996-.016-1.955-3.2.696-3.876-1.543-3.876-1.543-.523-1.328-1.277-1.682-1.277-1.682-1.044-.714.08-.7.08-.7 1.156.081 1.764 1.187 1.764 1.187 1.027 1.76 2.695 1.252 3.351.957.104-.744.402-1.252.73-1.54-2.554-.29-5.24-1.277-5.24-5.683 0-1.255.449-2.282 1.184-3.086-.119-.291-.514-1.46.113-3.043 0 0 .965-.31 3.163 1.179A11.04 11.04 0 0 1 12 6.059c.978.005 1.962.132 2.88.387 2.196-1.489 3.159-1.179 3.159-1.179.63 1.583.234 2.752.115 3.043.737.804 1.183 1.831 1.183 3.086 0 4.417-2.69 5.39-5.253 5.675.414.357.783 1.058.783 2.13 0 1.538-.014 2.779-.014 3.155 0 .307.207.666.79.553A11.5 11.5 0 0 0 12 .5Z" />
      ) : (
        <>
          <rect x="1" y="1" width="22" height="22" rx="2" />
          <g className="contact-linkedin-mark">
            <circle cx="6.3" cy="6.5" r="1.5" />
            <path d="M5 9h2.6v10H5zM10 9h2.5v1.4c.7-1 1.6-1.6 3-1.6 2.6 0 3.5 1.7 3.5 4.4V19h-2.6v-5.3c0-1.5-.3-2.5-1.7-2.5-1.6 0-2.1 1.1-2.1 2.7V19H10z" />
          </g>
        </>
      )}
    </svg>
  );
}

export default function ContactLinks() {
  const { t } = useI18n();
  return (
    <ul className="contact-links">
      {contactLinks.map(({ label, value, href, external, icon }) => (
        <li key={label}>
          <a
            className={icon ? "contact-social" : undefined}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
          >
            {icon ? (
              <>
                <SocialIcon name={icon} />
                <span className="contact-platform">{t(label)}</span>
              </>
            ) : (
              <>
                <span>
                  <small>{t(label)}</small>
                  <span>{value}</span>
                </span>
                <span aria-hidden="true">{external ? "↗" : "→"}</span>
              </>
            )}
            {external && <span className="sr-only"> ({t("opens in a new tab")})</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
