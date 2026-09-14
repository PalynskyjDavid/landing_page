import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { cameraMessages, createCameraSession } from "./cameraSession.js";

export default function HandLandmarkDemo() {
  const { t } = useI18n();
  const [status, setStatus] = useState("idle");
  const [hands, setHands] = useState(0);
  const video = useRef(null);
  const canvas = useRef(null);
  const session = useRef(null);
  const active = ["requesting", "loading", "running"].includes(status);

  useEffect(() => {
    function hide() {
      if (!session.current) return;
      session.current.stop();
      session.current = null;
      setHands(0);
      setStatus("stopped");
    }
    function visibility() {
      if (document.hidden) hide();
    }
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    return () => {
      session.current?.stop();
      session.current = null;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
    };
  }, []);

  function stop() {
    session.current?.stop();
    session.current = null;
    setHands(0);
    setStatus("stopped");
  }
  function start() {
    if (session.current) return;
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !window.Worker ||
      !window.WebAssembly ||
      !window.createImageBitmap ||
      !window.OffscreenCanvas
    ) {
      setStatus("unsupported");
      return;
    }
    setHands(0);
    const current = createCameraSession({
      video: video.current,
      canvas: canvas.current,
      onStatus: (next) => {
        setStatus(next);
        if (!["requesting", "loading", "running"].includes(next)) session.current = null;
      },
      onHands: setHands,
    });
    session.current = current;
    void current.start();
  }
  return (
    <figure className="hand-demo" aria-labelledby="hand-demo-title">
      <div className="hand-demo-heading">
        <h2 id="hand-demo-title">{t("Live hand landmarks")}</h2>
        <span>MediaPipe</span>
      </div>
      <div className="hand-camera-viewport">
        <video ref={video} muted playsInline className="hand-camera-source" aria-hidden="true" />
        <canvas
          ref={canvas}
          width="640"
          height="480"
          className="hand-camera-canvas"
          hidden={status !== "running"}
          role="img"
          aria-label={t("Mirrored camera view with hand landmarks")}
        />
        {status !== "running" && (
          <div className="hand-camera-placeholder">
            <span aria-hidden="true">21</span>
            <p>{t("Landmarks per hand. Camera for touchless interaction with your device.")}</p>
          </div>
        )}
      </div>
      <div className="hand-demo-controls">
        <p className="hand-demo-state" data-state={status} role="status">
          {t(cameraMessages[status])}
        </p>
        <div className="hand-demo-buttons">
          <button
            type="button"
            disabled={active}
            onClick={start}
            aria-describedby="hand-camera-privacy"
          >
            {t("Start camera")}
          </button>
          <button type="button" disabled={!active} onClick={stop}>
            {t("Stop camera")}
          </button>
        </div>
        <p className="hand-demo-count" aria-live="polite" aria-atomic="true">
          {status === "running"
            ? t("Hands detected: {{hands}} / 2", { hands })
            : active
              ? t("You can cancel at any time.")
              : t("No camera or model loads until you start.")}
        </p>
      </div>
      <figcaption id="hand-camera-privacy">
        {t(
          "Video stays in this browser. No recording, uploads, microphone or mouse control. The camera stops when you leave this page or switch tabs.",
        )}
      </figcaption>
    </figure>
  );
}
