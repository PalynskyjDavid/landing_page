import { gzipSync } from "node:zlib";

const gzipBytes = (source) => gzipSync(source, { level: 5 }).byteLength;

// Inspect the actual production import graph, not source-code text or chunk names.
export function checkFlowentoBundle(bundle) {
  const chunks = Object.values(bundle).filter((item) => item.type === "chunk");
  const hasModule = (chunk, suffix) =>
    Object.keys(chunk.modules).some((id) => id.replaceAll("\\", "/").includes(suffix));
  const entry = chunks.filter((chunk) => chunk.isEntry);
  const page = chunks.find((chunk) => hasModule(chunk, "/src/pages/FlowentoPage.jsx"));
  const renderers = chunks.filter((chunk) => hasModule(chunk, "/node_modules/three/"));
  if (!entry.length || !page || !renderers.length)
    throw new Error("Flowento budget: expected the app, project page and Three.js chunks.");

  function reachable(roots) {
    const visited = new Set();
    function visit(name) {
      if (visited.has(name)) return;
      visited.add(name);
      for (const dependency of bundle[name]?.imports ?? []) visit(dependency);
    }
    for (const chunk of roots) visit(chunk.fileName);
    return visited;
  }
  const homeFiles = reachable(entry);
  const pageFiles = reachable([page]);
  if (homeFiles.has(page.fileName))
    throw new Error("Flowento budget: the project page must stay lazy-loaded from the homepage.");
  if (renderers.some((chunk) => homeFiles.has(chunk.fileName) || pageFiles.has(chunk.fileName)))
    throw new Error("Flowento budget: Three.js must load only after the reader opens 3D.");

  function asset(prefix, extension, limit) {
    const matches = Object.values(bundle).filter(
      (item) =>
        item.type === "asset" &&
        item.fileName.startsWith("assets/" + prefix + "-") &&
        item.fileName.endsWith(extension),
    );
    if (matches.length !== 1)
      throw new Error("Flowento budget: expected one content-hashed " + prefix + " asset.");
    const bytes = Buffer.from(matches[0].source);
    if (bytes.length > limit) throw new Error("Flowento budget exceeded: " + prefix);
    return { raw: bytes.length, gzip: gzipBytes(bytes) };
  }
  const model = asset("mirror-frame-2025-10", ".glb", 400000);
  const poster = asset("mirror-preview", ".png", 80000);
  function scripts(files, excluded = new Set()) {
    return chunks
      .filter((chunk) => files.has(chunk.fileName) && !excluded.has(chunk.fileName))
      .reduce((total, chunk) => total + gzipBytes(chunk.code), 0);
  }
  const pageJS = scripts(pageFiles, homeFiles);
  const rendererJS = scripts(reachable(renderers), new Set([...homeFiles, ...pageFiles]));
  if (pageJS > 25000) throw new Error("Flowento budget exceeded: project-page JavaScript.");
  if (rendererJS > 200000) throw new Error("Flowento budget exceeded: on-demand 3D JavaScript.");
  return { pageJS, rendererJS, model, poster };
}

export function flowentoBudgetPlugin() {
  return {
    name: "flowento-loading-budget",
    apply: "build",
    generateBundle(_options, bundle) {
      try {
        const size = checkFlowentoBundle(bundle);
        this.info(
          "Lazy-loading verified. Project JS: " +
            Math.round(size.pageJS / 1000) +
            " kB gzip; opt-in 3D JS + model: " +
            Math.round((size.rendererJS + size.model.gzip) / 1000) +
            " kB gzip; preview: " +
            Math.round(size.poster.raw / 1000) +
            " kB.",
        );
      } catch (error) {
        this.error(error.message);
      }
    },
  };
}
