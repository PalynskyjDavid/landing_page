import { HandLandmarker } from "@mediapipe/tasks-vision";
import wasmLoaderPath from "@mediapipe/tasks-vision/vision_wasm_module_internal.js?url";
import wasmBinaryPath from "@mediapipe/tasks-vision/vision_wasm_module_internal.wasm?url";
import modelAssetPath from "../../assets/hand-controller/hand_landmarker.task?url";

let detector;
// This module runs in its own thread. Only landmarks come back, never OS inputs.
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      detector = await HandLandmarker.createFromOptions(
        { wasmLoaderPath, wasmBinaryPath },
        {
          baseOptions: { modelAssetPath, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        },
      );
      self.postMessage({ type: "ready" });
    } else if (data.type === "frame" && detector) {
      const { landmarks } = detector.detectForVideo(data.frame, data.timestamp);
      self.postMessage({ type: "landmarks", landmarks });
    }
  } catch {
    self.postMessage({ type: "error" });
  } finally {
    data.frame?.close();
  }
};
