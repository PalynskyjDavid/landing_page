import { Link } from "react-router-dom";
import { useI18n } from "../i18n/useI18n.js";
function Card({ children, className = "" }) {
  return (
    <div
      className={
        "rounded-[var(--radius)] border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--card-fg))] shadow-sm " +
        className
      }
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const { t } = useI18n();
  return (
    <section className="py-14 sm:py-18">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h1 className="text-[var(--fs-display)] font-bold tracking-tight leading-[1.05]">
            {t("Themed landing page")}
            <span className="block text-[rgb(var(--muted-fg))]">
              {t("with a mini-game + events")}
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-[var(--fs-body)] text-[rgb(var(--muted-fg))] leading-relaxed">
            {t("Start editing tokens in {{file}} to change the whole look instantly.", {
              file: "src/index.css",
            })}
          </p>
        </div>

        <div className="grid gap-4">
          <Card className="p-5 sm:p-6">
            <p className="text-xs uppercase tracking-widest">{t("Selected project")}</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight">Flowento.</h2>
            <p className="mt-3 leading-relaxed">
              {t("A smart mirror, its web application, and my part in connecting the two.")}
            </p>
            <Link className="ui-btn inline-flex mt-5" to="/projects/flowento">
              {t("View Flowento project")} ↗︎
            </Link>
          </Card>
          <Card className="p-5 sm:p-6">
            <p className="text-xs uppercase tracking-widest">{t("Desktop prototype")}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Hand Controller.</h2>
            <p className="mt-3 leading-relaxed">
              {t(
                "Configurable webcam gestures, desktop actions, and the lessons from testing them.",
              )}
            </p>
            <Link className="ui-btn inline-flex mt-5" to="/projects/hand-controller">
              {t("View Hand Controller project")} ↗︎
            </Link>
          </Card>
        </div>
      </div>
    </section>
  );
}
