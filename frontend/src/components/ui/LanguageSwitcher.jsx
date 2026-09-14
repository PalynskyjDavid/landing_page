import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";

const languages = [
  { code: "en", label: "EN", name: "English" },
  { code: "cs", label: "CZ", name: "Čeština" },
];

// Inline flags render consistently on Windows too (unlike flag emoji).
function LanguageFlag({ code }) {
  return (
    <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false">
      {code === "cs" ? (
        <>
          <path fill="#fff" d="M0 0h30v20H0z" />
          <path fill="#d7141a" d="M0 10h30v10H0z" />
          <path fill="#11457e" d="m0 0 15 10L0 20z" />
        </>
      ) : (
        <>
          <path fill="#012169" d="M0 0h30v20H0z" />
          <path stroke="#fff" strokeWidth="5" d="m0 0 30 20m0-20L0 20" />
          <path stroke="#c8102e" strokeWidth="2" d="m0 0 30 20m0-20L0 20" />
          <path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30" />
          <path stroke="#c8102e" strokeWidth="4" d="M15 0v20M0 10h30" />
        </>
      )}
    </svg>
  );
}

export default function LanguageSwitcher() {
  const { t, i18n, language } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const options = useRef([]);
  const initialFocus = useRef(0);
  const id = useId();
  const selected = languages.find((item) => item.code === language) ?? languages[0];

  useEffect(() => {
    if (!open) return;
    options.current[initialFocus.current]?.focus();
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }
  function show(index = 0) {
    initialFocus.current = index;
    setOpen(true);
    if (open) options.current[index]?.focus();
  }
  function menuKey(event, index) {
    const next = {
      ArrowDown: (index + 1) % languages.length,
      ArrowUp: (index + languages.length - 1) % languages.length,
      Home: 0,
      End: languages.length - 1,
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      options.current[next]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      // Return to the trigger before the browser follows the normal Tab order.
      close(true);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const match = languages.findIndex((item) =>
        item.name.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()),
      );
      if (match >= 0) {
        event.preventDefault();
        options.current[match]?.focus();
      }
    }
  }

  return (
    <div
      className="language-switcher"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="language-trigger"
        aria-label={t("Language: {{language}}", { language: selected.name })}
        title={t("Language")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            show(event.key === "ArrowUp" ? languages.length - 1 : 0);
          } else if (event.key === "Escape" && open) close(true);
        }}
      >
        <LanguageFlag code={selected.code} />
        <span>{selected.label}</span>
        <svg
          className="language-chevron"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div id={id} className="language-menu" role="menu" aria-label={t("Language")}>
          {languages.map(({ code, label, name }, index) => (
            <button
              ref={(element) => {
                options.current[index] = element;
              }}
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={language === code}
              aria-label={name}
              className="language-option"
              tabIndex={-1}
              lang={code}
              onKeyDown={(event) => menuKey(event, index)}
              onClick={() => {
                void i18n.changeLanguage(code);
                close(true);
              }}
            >
              <LanguageFlag code={code} />
              <span>
                {name}
                <small>{label}</small>
              </span>
              <svg
                className="language-check"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                focusable="false"
              >
                <path d="m3 8 3 3 7-7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
