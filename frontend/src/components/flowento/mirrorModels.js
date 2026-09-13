// Actual CAD nodes, not a complete electronics bill of materials.
// Offsets are illustrative world-space distances at the viewer's normalized size.
const housingTravel = { start: 0.3, end: 0.4, offset: [0.35, -0.05, -1.7] };

export const mirrorStages = [
  { id: "cover", label: "Back cover", end: 20 },
  { id: "housing", label: "Rear housing", end: 40 },
  { id: "mounts", label: "Mounting pieces", end: 60 },
  { id: "inner", label: "Inner display panel", end: 80 },
  { id: "mirror", label: "Mirror panel", end: 100 },
];

export const mirrorModel = {
  url: new URL("../../assets/flowento/mirror-frame-2025-10.glb", import.meta.url).href,
  poster: new URL("../../assets/flowento/mirror-preview.png", import.meta.url).href,
  parts: [
    {
      id: "cover",
      label: "Back cover",
      description: "The panel that closes the rear of the assembly.",
      nodes: ["Frame_component_12"],
      color: "#446779",
      motions: [{ start: 0, end: 0.2, offset: [0, 0, -2.6] }],
    },
    {
      id: "door",
      label: "Housing access door",
      description:
        "The separate panel with an access slot inside the rear housing. It slides out before the housing moves.",
      nodes: ["Frame_component_2"],
      color: "#d3b575",
      motions: [{ start: 0.2, end: 0.3, offset: [0, 0, -0.4] }, housingTravel],
    },
    {
      id: "housing",
      label: "Rear housing",
      description:
        "The rear enclosure and its attachment pieces. The access door is a separate component.",
      nodes: ["Frame_component_1", "Frame_component_3", "Frame_component_4"],
      color: "#52a59a",
      motions: [housingTravel],
    },
    {
      id: "mounts",
      label: "Mounting pieces",
      description: "Internal rails and attachment pieces.",
      nodes: ["Frame_component_9", "Frame_component_10", "Frame_component_11"],
      color: "#d9a04f",
      motions: [{ start: 0.4, end: 0.6, offset: [-0.3, 0.1, -1.15] }],
    },
    {
      id: "inner",
      label: "Inner display panel",
      description: "The flat layer behind the mirror panel.",
      nodes: ["Frame_component_8"],
      color: "#72769d",
      motions: [{ start: 0.6, end: 0.8, offset: [0, 0, -0.65] }],
    },
    {
      id: "mirror",
      label: "Mirror panel",
      description: "The front panel of the mirror.",
      nodes: ["Mirror_surface"],
      color: "#83cdd7",
      motions: [{ start: 0.8, end: 1, offset: [0, 0, 0.7] }],
    },
    {
      id: "frame",
      label: "Outer frame",
      description: "The surrounding rim and side walls stay in place during disassembly.",
      nodes: ["Frame_component_6", "Frame_component_7"],
      color: "#284b63",
      motions: [],
    },
  ],
};
