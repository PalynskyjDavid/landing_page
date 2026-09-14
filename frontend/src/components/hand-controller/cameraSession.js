export const cameraMessages = {
  idle: "Camera is off. Start when you are ready.",
  requesting: "Allow camera access in your browser to continue.",
  loading: "Loading the hand-tracking model…",
  running: "Camera is on. Hold one or both hands in view.",
  stopped: "Camera stopped. You can start it again at any time.",
  unsupported:
    "This demo needs HTTPS or localhost and a browser with camera and WebAssembly support.",
  denied: "Camera permission was denied. Allow it in your browser's site settings, then try again.",
  missing: "No camera was found. Connect a camera and try again.",
  busy: "The camera could not start. Close other apps using it, then try again.",
  model: "Hand tracking could not load or run. Check your connection and browser, then try again.",
  ended: "The camera disconnected or access was revoked. Reconnect it and try again.",
};

export function cameraErrorKey(error) {
  if (["NotAllowedError", "SecurityError"].includes(error?.name)) return "denied";
  if (["NotFoundError", "OverconstrainedError"].includes(error?.name)) return "missing";
  return "busy";
}

export const handConnections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

export function drawLandmarks(context, hands, width, height) {
  for (const [index, points] of hands.entries()) {
    context.strokeStyle = index === 0 ? "#b5efb9" : "#cbb8ff";
    context.lineWidth = 3;
    context.beginPath();
    for (const [from, to] of handConnections) {
      context.moveTo(points[from].x * width, points[from].y * height);
      context.lineTo(points[to].x * width, points[to].y * height);
    }
    context.stroke();
    for (const point of points) {
      context.beginPath();
      context.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2);
      context.fillStyle = "#ffcc7d";
      context.fill();
      context.strokeStyle = "#18223b";
      context.lineWidth = 1;
      context.stroke();
    }
  }
}

// A single cancellable owner for the stream, worker, bitmap and animation loop.
// Dependencies are injectable so lifecycle tests never touch a real camera.
export function createCameraSession({
  video,
  canvas,
  onStatus,
  onHands,
  makeWorker = () =>
    new Worker(new URL("./handLandmarker.worker.js", import.meta.url), { type: "module" }),
  getMedia = (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  bitmap = (source, options) => createImageBitmap(source, options),
  raf = requestAnimationFrame,
  cancelRaf = cancelAnimationFrame,
}) {
  let disposed = false;
  let stream;
  let worker;
  let animation;
  let timer;
  let inFlight = false;
  let lastTime = -1;
  let lastSent = -Infinity;
  const context = canvas.getContext("2d", { alpha: false });
  const ended = () => fail("ended");
  function stop() {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
    cancelRaf(animation);
    for (const track of stream?.getTracks() ?? []) {
      track.removeEventListener("ended", ended);
      track.stop();
    }
    worker?.terminate();
    video.pause();
    video.srcObject = null;
    context?.clearRect(0, 0, canvas.width, canvas.height);
  }
  function fail(key) {
    if (disposed) return;
    stop();
    onStatus(key);
  }
  function watch(timeout) {
    clearTimeout(timer);
    timer = setTimeout(() => fail("model"), timeout);
  }
  async function tick(timestamp) {
    if (disposed) return;
    animation = raf(tick);
    // Up to 15 fps, one frame in flight; slow devices simply process fewer frames.
    if (
      inFlight ||
      timestamp - lastSent < 1000 / 15 ||
      video.readyState < 2 ||
      lastTime === video.currentTime
    )
      return;
    inFlight = true;
    lastSent = timestamp;
    lastTime = video.currentTime;
    let frame;
    try {
      const height = Math.max(1, Math.round((640 * video.videoHeight) / video.videoWidth));
      frame = await bitmap(video, { resizeWidth: 640, resizeHeight: height });
      if (disposed) {
        frame.close();
        return;
      }
      canvas.width = 640;
      canvas.height = height;
      context.drawImage(frame, 0, 0);
      watch(10000);
      worker.postMessage({ type: "frame", frame, timestamp }, [frame]);
      frame = null; // Ownership transferred to the worker, which closes it.
    } catch {
      frame?.close();
      fail("model");
    }
  }
  async function start() {
    try {
      onStatus("requesting");
      const acquired = await getMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 30 },
        },
      });
      if (disposed) {
        acquired.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = acquired;
      stream.getTracks().forEach((track) => track.addEventListener("ended", ended));
      video.srcObject = stream;
      await video.play();
      if (disposed) return;
    } catch (error) {
      fail(cameraErrorKey(error));
      return;
    }
    try {
      if (!context) throw new Error("Canvas unavailable");
      onStatus("loading");
      watch(60000);
      worker = makeWorker();
      worker.onerror = () => fail("model");
      worker.onmessageerror = () => fail("model");
      worker.onmessage = ({ data }) => {
        if (disposed) return;
        if (data.type === "error") {
          fail("model");
          return;
        }
        if (data.type === "ready") {
          clearTimeout(timer);
          onStatus("running");
          animation = raf(tick);
        } else if (data.type === "landmarks") {
          clearTimeout(timer);
          drawLandmarks(context, data.landmarks, canvas.width, canvas.height);
          onHands(data.landmarks.length);
          inFlight = false;
        }
      };
      worker.postMessage({ type: "init" });
    } catch {
      fail("model");
    }
  }
  return { start, stop };
}
