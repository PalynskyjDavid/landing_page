// Readable counterpart of the approved September 2026 graphic CV.
// Keep contribution boundaries, dates and experience qualifiers aligned with the PDF.
export const cvProfile =
  "I am looking for a junior full-stack role where I can build applications alongside an experienced team and learn how user needs and business priorities shape technical decisions.";

export const cvSkills = [
  {
    title: "Programming languages",
    items: ["JavaScript", "TypeScript", "SQL"],
    note: "Project experience with Go and Rust.",
  },
  {
    title: "Frontend",
    items: [
      "HTML",
      "CSS",
      "React",
      "Vite",
      "Tailwind CSS",
      "Bootstrap",
      "React Router",
      "Recharts",
    ],
  },
  {
    title: "Backend and data",
    items: ["Node.js", "Express", "PostgreSQL", "MongoDB", "Mongoose", "Joi"],
  },
  {
    title: "APIs and state",
    items: [
      "REST APIs",
      "OpenAPI",
      "Axios",
      "React Context",
      "TanStack Query",
      "Postman",
      "Insomnia",
    ],
  },
  {
    title: "Testing and delivery",
    items: [
      "Playwright",
      "Vitest",
      "Git",
      "GitHub Actions",
      "Docker Compose",
      "ESLint",
      "Prettier",
    ],
  },
];

export const cvProjects = [
  {
    title: "Flowento smart mirror",
    route: "/projects/flowento",
    context: "Team project",
    technologies: ["React", "Express", "MongoDB"],
    note: "Private project. Code and 3D model details available on request.",
    points: [
      "Implemented mirror-management screens, feature routing and React Context providers for data fetching, loading states, filtering and pagination.",
      "Built REST endpoints with Mongoose models and Joi validation, and integrated device sharing and user invitations.",
      "Created audit and statistics views with charts, time-windowed database aggregations, and CSV, XLSX and PDF exports.",
    ],
  },
  {
    title: "Reaction game and statistics",
    route: "/game",
    context: "Personal project, AI-assisted",
    technologies: ["React", "Tailwind CSS", "Go", "PostgreSQL"],
    points: [
      "Defined and validated a five-round game with server-calculated scores, player statistics, filtering and rate limits.",
      "Added persistent score retries and duplicate-safe submissions; tested score recovery after API restarts.",
      "Deployed with Docker and HTTPS on an Ubuntu VPS; GitHub Actions runs unit, database and Playwright tests.",
    ],
  },
  {
    title: "Hand Controller",
    route: "/projects/hand-controller",
    context: "Bachelor's thesis prototype, AI-assisted",
    technologies: ["Rust", "Tauri", "TypeScript", "MediaPipe"],
    note: "Planned integration into the smart mirror.",
    points: [
      "Developed configurable webcam gesture controls, mapping hand landmarks to mouse and keyboard actions.",
      "Evaluated gesture timing and pipeline latency, with diagnostic views and configuration profiles for controlled Windows testing.",
    ],
  },
];

export const cvEducation = [
  {
    school: "Unicorn University",
    program: "Software Engineering and Big Data",
    period: "2026–present",
  },
  {
    school: "Unicorn University",
    program: "Software Development, bachelor's programme",
    period: "2023–2026",
  },
  { school: "ČVUT FEL", program: "Cybernetics and Robotics", period: "2023" },
  { school: "SSŠVT", program: "Programming and Database Systems", period: "2018–2022" },
];
export const cvLanguages = ["English C1", "Czech", "Ukrainian"];
