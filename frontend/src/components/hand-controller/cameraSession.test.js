import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resources } from "../../i18n/config.js";
import {
  cameraErrorKey,
  cameraMessages,
  createCameraSession,
  drawLandmarks,
} from "./cameraSession.js";

function fixture(overrides = {}) {
  const track = { stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const stream = { getTracks: () => [track] };
  const context = Object.fromEntries(
    ["clearRect", "drawImage", "beginPath", "moveTo", "lineTo", "stroke", "arc", "fill"].map(
      (key) => [key, vi.fn()],
    ),
  );
  let canvasWidth = 640,
    canvasHeight = 480;
  const canvas = {
    get width() {
      return canvasWidth;
    },
    set width(value) {
      canvasWidth = value;
    },
    get height() {
      return canvasHeight;
    },
    set height(value) {
      canvasHeight = value;
    },
    getContext: () => context,
  };
  const video = {
    play: vi.fn().mockResolvedValue(),
    pause: vi.fn(),
    readyState: 2,
    currentTime: 1,
    videoWidth: 640,
    videoHeight: 480,
  };
  const worker = { terminate: vi.fn(), postMessage: vi.fn() };
  const frame = { width: 640, height: 480, close: vi.fn() };
  const dependencies = {
    video,
    canvas,
    onStatus: vi.fn(),
    onHands: vi.fn(),
    getMedia: vi.fn().mockResolvedValue(stream),
    makeWorker: vi.fn(() => worker),
    bitmap: vi.fn().mockResolvedValue(frame),
    raf: vi.fn(() => 1),
    cancelRaf: vi.fn(),
    ...overrides,
  };
  const session = createCameraSession(dependencies);
  return { ...dependencies, track, stream, worker, context, frame, ...session };
}
afterEach(() => vi.useRealTimers());
describe("private hand camera session", () => {
  it("does nothing before start; requests video only and owns cleanup", async () => {
    const f = fixture();
    expect(f.getMedia).not.toHaveBeenCalled();
    expect(f.makeWorker).not.toHaveBeenCalled();
    await f.start();
    expect(f.getMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
    expect(f.video.srcObject).toBe(f.stream);
    f.stop();
    f.stop();
    expect(f.track.stop).toHaveBeenCalledTimes(1);
    expect(f.worker.terminate).toHaveBeenCalledTimes(1);
    expect(f.video.srcObject).toBeNull();
  });
  it("releases a permission result that arrives after cancellation", async () => {
    let resolve;
    const f = fixture({
      getMedia: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    const pending = f.start();
    f.stop();
    resolve(f.stream);
    await pending;
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.makeWorker).not.toHaveBeenCalled();
    expect(f.video.srcObject).toBeNull();
  });
  it.each([
    ["NotAllowedError", "denied"],
    ["NotFoundError", "missing"],
    ["NotReadableError", "busy"],
  ])("handles %s without downloading a model", async (name, key) => {
    const f = fixture({ getMedia: vi.fn().mockRejectedValue({ name }) });
    await f.start();
    expect(f.onStatus).toHaveBeenLastCalledWith(key);
    expect(f.makeWorker).not.toHaveBeenCalled();
    expect(cameraErrorKey({ name })).toBe(key);
  });
  it("stops camera and worker when model loading times out", async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.start();
    vi.advanceTimersByTime(60000);
    expect(f.onStatus).toHaveBeenLastCalledWith("model");
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.worker.terminate).toHaveBeenCalledOnce();
  });
  it("handles revoked camera access and worker failure", async () => {
    const f = fixture();
    await f.start();
    f.track.addEventListener.mock.calls[0][1]();
    expect(f.onStatus).toHaveBeenLastCalledWith("ended");
    const other = fixture();
    await other.start();
    other.worker.onerror();
    expect(other.track.stop).toHaveBeenCalledOnce();
    expect(other.onStatus).toHaveBeenLastCalledWith("model");
  });
  it("allows only one frame in flight and closes a late bitmap", async () => {
    let resolve;
    const f = fixture({
      bitmap: vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      ),
    });
    await f.start();
    f.worker.onmessage({ data: { type: "ready" } });
    const tick = f.raf.mock.calls[0][0];
    const pending = tick(100);
    await tick(200);
    expect(f.bitmap).toHaveBeenCalledOnce();
    f.stop();
    resolve(f.frame);
    await pending;
    expect(f.frame.close).toHaveBeenCalledOnce();
    expect(f.worker.postMessage).toHaveBeenCalledTimes(1); // init only
  });
  it("keeps the complete preview visible until the next frame and landmarks are ready", async () => {
    const f = fixture();
    const width = vi.spyOn(f.canvas, "width", "set");
    const height = vi.spyOn(f.canvas, "height", "set");
    await f.start();
    f.worker.onmessage({ data: { type: "ready" } });
    const tick = f.raf.mock.calls[0][0];
    await tick(100);
    expect(f.context.drawImage).not.toHaveBeenCalled();
    expect(f.worker.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "frame" }),
      [f.frame],
    );
    const landmarks = [Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.25 }))];
    f.worker.onmessage({ data: { type: "landmarks", landmarks, frame: f.frame } });
    expect(f.context.drawImage).toHaveBeenCalledWith(f.frame, 0, 0);
    expect(f.context.arc).toHaveBeenCalledTimes(21);
    expect(f.onHands).toHaveBeenLastCalledWith(1);
    expect(f.frame.close).toHaveBeenCalledOnce();
    // A slow result must not create a camera-only frame between skeletons.
    f.video.currentTime = 2;
    await tick(200);
    f.video.currentTime = 3;
    await tick(400);
    expect(f.bitmap).toHaveBeenCalledTimes(2);
    expect(f.context.drawImage).toHaveBeenCalledOnce();
    expect(f.context.clearRect).not.toHaveBeenCalled();
    expect(width).not.toHaveBeenCalled();
    expect(height).not.toHaveBeenCalled();
    // An actual no-hands result replaces the preview, without ghost landmarks.
    const next = { width: 640, height: 360, close: vi.fn() };
    f.worker.onmessage({ data: { type: "landmarks", landmarks: [], frame: next } });
    expect(f.context.drawImage).toHaveBeenLastCalledWith(next, 0, 0);
    expect(f.onHands).toHaveBeenLastCalledWith(0);
    expect(f.context.arc).toHaveBeenCalledTimes(21);
    expect(height).toHaveBeenCalledExactlyOnceWith(360);
    expect(width).not.toHaveBeenCalled();
    expect(next.close).toHaveBeenCalledOnce();
    f.stop();
  });
  it("closes a returned worker bitmap after cancellation without repainting", async () => {
    const f = fixture();
    await f.start();
    f.stop();
    f.worker.onmessage({ data: { type: "landmarks", landmarks: [], frame: f.frame } });
    expect(f.frame.close).toHaveBeenCalledOnce();
    expect(f.context.drawImage).not.toHaveBeenCalled();
    expect(f.onHands).not.toHaveBeenCalled();
  });
  it("releases the returned bitmap and camera if rendering fails", async () => {
    const f = fixture();
    await f.start();
    f.context.drawImage.mockImplementation(() => {
      throw new Error("Canvas lost");
    });
    f.worker.onmessage({ data: { type: "landmarks", landmarks: [], frame: f.frame } });
    expect(f.frame.close).toHaveBeenCalledOnce();
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.onStatus).toHaveBeenLastCalledWith("model");
  });
  it("stops and clears the last preview if inference never returns", async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.start();
    f.worker.onmessage({ data: { type: "ready" } });
    await f.raf.mock.calls[0][0](100);
    vi.advanceTimersByTime(10000);
    expect(f.worker.terminate).toHaveBeenCalledOnce();
    expect(f.context.clearRect).toHaveBeenCalledOnce();
    expect(f.onStatus).toHaveBeenLastCalledWith("model");
  });
  it("draws 21 landmarks and 21 connections per hand", () => {
    const f = fixture();
    drawLandmarks(f.context, [Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.25 }))], 640, 480);
    expect(f.context.arc).toHaveBeenCalledTimes(21);
    expect(f.context.moveTo).toHaveBeenCalledTimes(21);
    expect(f.context.arc).toHaveBeenCalledWith(320, 120, 4, 0, Math.PI * 2);
    f.stop();
  });
  it("translates every dynamic status, including failures", () => {
    for (const key of Object.values(cameraMessages))
      for (const locale of ["en", "cs"])
        expect(resources[locale].translation[key], key).toBeTruthy();
  });
});

it("keeps the versioned public hand model unchanged", () => {
  const bytes = readFileSync(
    new URL("../../assets/hand-controller/hand_landmarker.task", import.meta.url),
  );
  expect(bytes.length).toBe(7819105);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1",
  );
});
