// Technology-specific contribution copy; keep ownership scoped to verified work.
export const flowentoContributions = [
  {
    id: "mongodb",
    name: "MongoDB / Mongoose",
    category: "Data storage",
    details: [
      {
        title: "Persistence layer design",
        description:
          "I added Mongoose schemas for audit events and stored summaries, defining how this diagnostic data is persisted.",
      },
      {
        title: "Queries & aggregation",
        description:
          "I worked on query filtering for grids and audit logs, and time-windowed aggregation for audit statistics.",
      },
    ],
  },
  {
    id: "react",
    name: "React",
    category: "Frontend",
    details: [
      {
        title: "Views & interactions",
        description:
          "I worked on audit-log and statistics views, connecting filters and pagination controls to API results.",
      },
      {
        title: "Context & providers",
        description:
          "I updated React providers and the frontend data flow when API filters and response shapes changed.",
      },
    ],
  },
  {
    id: "express",
    name: "Node.js / Express",
    category: "Backend",
    details: [
      {
        title: "API filtering & pagination",
        description:
          "I updated audit and grid endpoints, connecting query parameters and response formats with the frontend controls.",
      },
      {
        title: "Route-based diagnostics",
        description:
          "I worked on route normalization, audit filtering, and response-time information to help investigate requests.",
      },
    ],
  },
  {
    id: "javascript",
    name: "JavaScript",
    category: "Language & exports",
    details: [
      {
        title: "Browser data exports",
        description:
          "I implemented exports of sensor and mirror data to JSON, CSV, Excel, and PDF, connecting download controls with the application data.",
      },
    ],
  },
  {
    id: "three",
    name: "Three.js",
    category: "3D visualization",
    contextOnly: true,
    details: [
      {
        title: "Interactive mirror presentation",
        description:
          "The original landing page and this simple showcase use Three.js to present the mirror.",
      },
    ],
  },
];
