import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";

import { mirrorModel, mirrorStages } from "./mirrorModels.js";

export default function MirrorViewer() {
  const { t } = useI18n();
  const host = useRef(null);
  const scene = useRef(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("idle");
  const [attempt, setAttempt] = useState(0);

  const [separation, setSeparation] = useState(0);
  const [selectedPart, setSelectedPart] = useState(null);
  const definition = mirrorModel;
  const animation = useRef(null);
  const progress = useRef(0);
  const [playing, setPlaying] = useState(false);
  const stageIndex = Math.min(4, Math.max(0, Math.ceil(separation / 20) - 1));
  const movingPart =
    separation > 20 && separation <= 30 ? "Housing access door" : mirrorStages[stageIndex].label;
  const stageText =
    separation === 0
      ? t("Assembled")
      : separation === 100
        ? t("Fully separated")
        : t("Stage {{number}} of 5: {{part}}", { number: stageIndex + 1, part: t(movingPart) });

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let instance;
    import("./mirrorScene.js")
      .then(({ mountMirrorScene }) => {
        if (disposed) return;
        instance = mountMirrorScene(host.current, {
          url: mirrorModel.url,
          parts: mirrorModel.parts,
          onReady: () => {
            if (!disposed) setStatus("ready");
          },
          onError: () => {
            if (!disposed) {
              cancelAnimationFrame(animation.current);
              animation.current = null;
              progress.current = 0;
              setPlaying(false);
              setStatus("error");
              setSeparation(0);
              setSelectedPart(null);
            }
          },
        });
        scene.current = instance;
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(animation.current);
      animation.current = null;
      instance?.dispose();
      scene.current = null;
    };
  }, [active, attempt]);

  function stopAnimation() {
    cancelAnimationFrame(animation.current);
    animation.current = null;
    setPlaying(false);
  }
  function resetParts() {
    stopAnimation();
    progress.current = 0;
    setSeparation(0);
    setSelectedPart(null);
  }
  function load() {
    resetParts();
    setStatus("loading");
    setActive(true);
    setAttempt((value) => value + 1);
  }
  function close() {
    resetParts();
    setActive(false);
    setStatus("idle");
  }
  function applySeparation(value) {
    progress.current = value;
    setSeparation(Math.round(value));
    scene.current?.separate(value / 100);
  }
  function separate(value) {
    stopAnimation();
    applySeparation(value);
  }
  function animateTo(target) {
    stopAnimation();
    const from = progress.current;
    // No automatic playback on load; respect the reader's reduced-motion preference.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || from === target) {
      applySeparation(target);
      return;
    }
    const start = performance.now();
    const duration = Math.abs(target - from) * 55;
    setPlaying(true);
    function tick(now) {
      const elapsed = Math.min(1, (now - start) / duration);
      applySeparation(from + (target - from) * elapsed);
      if (elapsed < 1) animation.current = requestAnimationFrame(tick);
      else {
        animation.current = null;
        setPlaying(false);
      }
    }
    animation.current = requestAnimationFrame(tick);
  }
  function inspect(id) {
    stopAnimation();
    setSelectedPart(id);
    scene.current?.selectPart(id);
  }
  return (
    <figure className="mirror-viewer" aria-label={t("Interactive Flowento mirror")}>
      <div className="mirror-viewer-heading">
        <span>{t("The physical prototype")}</span>
        <span className="mirror-dimension">3D / CAD</span>
      </div>
      <div className="mirror-stage">
        <img
          className="mirror-poster"
          src={definition.poster}
          alt={t("Angled view of the Flowento mirror model")}
          loading="lazy"
          decoding="async"
          width="960"
          height="1000"
          hidden={status === "ready"}
        />
        <div
          ref={host}
          className="mirror-canvas"
          role="img"
          aria-label={t("3D mirror model; use the view buttons or drag to rotate")}
          hidden={!active || status === "error"}
        />
        {status !== "ready" && (
          <div className="mirror-overlay">
            {status === "loading" ? (
              <p role="status">{t("Loading 3D model…")}</p>
            ) : (
              <>
                {status === "error" && (
                  <p role="status">
                    {t("3D is unavailable. You can still explore the project below.")}
                  </p>
                )}
                <button className="mirror-load" type="button" onClick={load}>
                  {status === "error" ? t("Retry 3D") : t("Explore in 3D")}{" "}
                  <span aria-hidden="true">↗︎</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {active && (
        <div className="mirror-control-panel">
          <div className="mirror-views" role="group" aria-label={t("Model controls")}>
            <button
              type="button"
              disabled={status !== "ready"}
              onClick={() => scene.current?.view("front")}
            >
              {t("Front")}
            </button>
            <button
              type="button"
              disabled={status !== "ready"}
              onClick={() => scene.current?.view("back")}
            >
              {t("Back")}
            </button>
            <button
              type="button"
              disabled={status !== "ready"}
              onClick={() => scene.current?.view("angle")}
            >
              {t("Reset view")}
            </button>
            <button
              type="button"
              disabled={status !== "ready"}
              aria-label={t("Zoom in")}
              onClick={() => scene.current?.zoom(0.85)}
            >
              +
            </button>
            <button
              type="button"
              disabled={status !== "ready"}
              aria-label={t("Zoom out")}
              onClick={() => scene.current?.zoom(1.15)}
            >
              −
            </button>
            <button type="button" onClick={close}>
              {t("Close 3D")}
            </button>
          </div>
          <p className="mirror-help">
            {t("Drag to rotate. Use the buttons to change the view or zoom.")}
          </p>
        </div>
      )}
      <figcaption className="mirror-components">
        <div className="mirror-components-heading">
          <strong>{t("Model components")}</strong>
          {active && (
            <button
              type="button"
              disabled={status !== "ready"}
              aria-pressed={selectedPart === null}
              onClick={() => inspect(null)}
            >
              {t("Show all parts")}
            </button>
          )}
        </div>
        <ul className="mirror-parts">
          {definition.parts.map((part) => (
            <li key={part.id}>
              <button
                type="button"
                disabled={status !== "ready"}
                aria-pressed={selectedPart === part.id}
                onClick={() => inspect(selectedPart === part.id ? null : part.id)}
              >
                <span
                  className="mirror-part-color"
                  style={{ "--part-color": part.color }}
                  aria-hidden="true"
                />
                {t(part.label)}
              </button>
            </li>
          ))}
        </ul>
        <p className="mirror-part-description" aria-live="polite">
          {selectedPart
            ? t(definition.parts.find((part) => part.id === selectedPart).description)
            : status === "ready"
              ? t("Select a component to inspect it on its own.")
              : t("Open 3D, then select a component to inspect it on its own.")}
        </p>
        {active && (
          <div className="mirror-separation">
            <label htmlFor="mirror-separation">{t("Part separation")}</label>
            <input
              id="mirror-separation"
              type="range"
              min="0"
              max="100"
              step="1"
              aria-describedby="mirror-stage-status"
              aria-valuetext={stageText}
              value={separation}
              disabled={status !== "ready" || selectedPart !== null}
              onPointerDown={stopAnimation}
              onKeyDown={(event) => {
                if (
                  [
                    "Home",
                    "End",
                    "ArrowUp",
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowRight",
                    "PageUp",
                    "PageDown",
                  ].includes(event.key)
                )
                  stopAnimation();
              }}
              onChange={(event) => separate(Number(event.target.value))}
            />
            <p id="mirror-stage-status" className="mirror-stage-status" role="status">
              {stageText}
            </p>
            <ol className="mirror-steps" aria-label={t("Disassembly stages")}>
              {mirrorStages.map((stage, index) => (
                <li key={stage.id}>
                  <button
                    type="button"
                    disabled={status !== "ready" || selectedPart !== null}
                    aria-current={separation > 0 && stageIndex === index ? "step" : undefined}
                    data-complete={separation >= stage.end}
                    onClick={() => animateTo(stage.end)}
                  >
                    <span>{index + 1}.</span> {t(stage.label)}
                  </button>
                </li>
              ))}
            </ol>
            <div className="mirror-separation-actions">
              <button
                type="button"
                disabled={status !== "ready" || selectedPart !== null}
                onClick={() => (playing ? stopAnimation() : animateTo(separation > 0 ? 0 : 100))}
              >
                {playing ? t("Pause") : separation > 0 ? t("Reassemble") : t("Exploded view")}
              </button>
              <span>
                {selectedPart
                  ? t("Show all parts to separate the assembly.")
                  : t(
                      "Follow the stages, or drag the slider. The housing door opens during stage 2.",
                    )}
              </span>
            </div>
          </div>
        )}
      </figcaption>
    </figure>
  );
}
