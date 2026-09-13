export const demoPinchThreshold = 30;

// Presentation-only example, not the desktop application's gesture recognizer.
export function pinchDemoState(distance, enabled) {
  if (distance > demoPinchThreshold) return "waiting";
  return enabled ? "ready" : "blocked";
}

export const handControllerPipeline = [
  {
    title: "See the hand",
    text: "A webcam frame becomes hand landmarks through MediaPipe. The app uses an existing model, not a model I trained.",
  },
  {
    title: "Match a gesture",
    text: "Landmark distances and finger-pose rules describe a gesture independently of the action it will trigger.",
  },
  {
    title: "Check the intent",
    text: "Priority, activation timing, cooldowns and explicit arming decide whether a matching gesture may act.",
  },
  {
    title: "Perform the action",
    text: "The Rust runtime sends the configured mouse or keyboard event. Profiles keep the chosen rules and bindings together.",
  },
];

export const handControllerContributions = [
  {
    id: "interface",
    name: "React / TypeScript",
    category: "Interface & configuration",
    title: "Make recognition understandable",
    text: "Camera feedback, gesture editing, action bindings and diagnostic views connect the recognition pipeline to controls people can inspect and tune.",
  },
  {
    id: "runtime",
    name: "Rust / Tauri",
    category: "Desktop runtime",
    title: "Separate detection from action",
    text: "The desktop runtime handles gesture decisions, profiles, action timing and cursor smoothing, while the web interface handles camera feedback and configuration.",
  },
  {
    id: "vision",
    name: "MediaPipe",
    category: "Computer vision integration",
    title: "Work with the model's limits",
    text: "Integrate pretrained hand landmarks and investigate how lighting, distance, occlusion and CPU/GPU settings affect practical gesture recognition.",
  },
  {
    id: "input",
    name: "Enigo",
    category: "Operating-system input",
    title: "Keep actions deliberate",
    text: "Connect configured gestures to mouse and keyboard events, with an explicit armed state and release handling for held actions such as dragging.",
  },
];

export const handControllerFindings = [
  {
    title: "Simple beats intricate",
    text: "Open palms and thumb-index pinches were more practical to work with than small, overlapping finger combinations.",
  },
  {
    title: "Latency is only part of the story",
    text: "Diagnostic views and recorded timing help distinguish slow processing from a gesture that the camera cannot recognize consistently.",
  },
  {
    title: "Environment matters",
    text: "Lighting, distance and motion blur affect tracking. The Linux VM experiment also exposed camera and WebView compatibility limits.",
  },
];
