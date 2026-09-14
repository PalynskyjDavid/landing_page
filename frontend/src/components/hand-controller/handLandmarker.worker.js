import { HandLandmarker } from "@mediapipe/tasks-vision";
import wasmLoaderPath from "@mediapipe/tasks-vision/vision_wasm_module_internal.js?url";
import wasmBinaryPath from "@mediapipe/tasks-vision/vision_wasm_module_internal.wasm?url";
import modelAssetPath from "../../assets/hand-controller/hand_landmarker.task?url";

let detector;
// This thread returns the original frame and its landmarks together for display.
// Nothing leaves the browser and no OS inputs are generated.
self.onmessage = async ({ data }) => {
  let frame = data.frame;
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
      const { landmarks } = detector.detectForVideo(frame, data.timestamp);
      self.postMessage({ type: "landmarks", landmarks, frame }, [frame]);
      frame = null; // Ownership transferred back; the UI closes it after drawing.
    }
  } catch {
    self.postMessage({ type: "error" });
  } finally {
    frame?.close();
  }
};
