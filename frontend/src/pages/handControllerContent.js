export const handControllerPipeline = [
  {
    title: "See the hand",
    text: "The app uses an existing model from Google to locate hand landmarks.",
  },
  {
    title: "Match a gesture",
    text: "Finger positions and distances identify the configured gesture.",
  },
  {
    title: "Check the intent",
    text: "Activation timing, priorities and an armed state help prevent unwanted actions.",
  },
  {
    title: "Perform the action",
    text: "The selected profile maps the gesture to a mouse or keyboard action.",
  },
];

export const handControllerContributions = [
  {
    id: "interface",
    name: "React / TypeScript",
    category: "Interface & configuration",
    title: "Gesture editor and live feedback",
    text: "Built controls for gesture rules, action bindings and profiles, with a live view for debugging.",
  },
  {
    id: "runtime",
    name: "Rust / Tauri",
    category: "Desktop runtime",
    title: "Gesture processing and profiles",
    text: "Connected the interface to a Rust runtime for gesture decisions, timing and cursor smoothing.",
  },
  {
    id: "vision",
    name: "MediaPipe",
    category: "Computer vision integration",
    title: "Hand tracking",
    text: "Integrated Google's pretrained model and tested tracking under different camera and runtime settings.",
  },
  {
    id: "input",
    name: "Enigo",
    category: "Operating-system input",
    title: "Mouse and keyboard control",
    text: "Mapped gestures to input events and handled button release after dragging.",
  },
];

export const handControllerFindings = [
  {
    title: "Simple beats intricate",
    text: "Open palms and thumb-index pinches were easier to use than intricate finger combinations.",
  },
  {
    title: "Make delays visible",
    text: "Timing logs helped separate slow processing from inconsistent gesture detection.",
  },
  {
    title: "Camera conditions matter",
    text: "Lighting, distance and motion blur affected how consistently hands were tracked.",
  },
];
