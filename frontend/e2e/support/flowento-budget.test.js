import { describe, expect, it } from "vitest";
import { checkFlowentoBundle } from "../../scripts/flowentoBudget.js";

function fixture() {
  const chunk = (fileName, module, imports = [], isEntry = false) => ({
    type: "chunk",
    fileName,
    code: "export const example = true;",
    isEntry,
    modules: { [module]: {} },
    imports,
  });
  return {
    "assets/app.js": chunk("assets/app.js", "/app/src/main.jsx", [], true),
    "assets/project.js": chunk("assets/project.js", "/app/src/pages/FlowentoPage.jsx", [
      "assets/app.js",
    ]),
    "assets/viewer.js": chunk("assets/viewer.js", "/app/node_modules/three/build/three.module.js", [
      "assets/app.js",
    ]),
    model: {
      type: "asset",
      fileName: "assets/mirror-frame-2025-10-hash.glb",
      source: new Uint8Array(1000),
    },
    poster: {
      type: "asset",
      fileName: "assets/mirror-preview-hash.png",
      source: new Uint8Array(100),
    },
  };
}

describe("Flowento production loading budget", () => {
  it("allows separate project and opt-in renderer chunks with shared runtime imports", () => {
    const result = checkFlowentoBundle(fixture());
    expect(result.pageJS).toBeGreaterThan(0);
    expect(result.rendererJS).toBeGreaterThan(0);
    expect(result.model.raw).toBe(1000);
  });
  it("rejects eager project loading", () => {
    const bundle = fixture();
    bundle["assets/app.js"].imports.push("assets/project.js");
    expect(() => checkFlowentoBundle(bundle)).toThrow("project page must stay lazy-loaded");
  });
  it("rejects Three.js leaking into the project page through a shared chunk", () => {
    const bundle = fixture();
    bundle["assets/project.js"].imports.push("assets/shared.js");
    bundle["assets/shared.js"] = {
      type: "chunk",
      fileName: "assets/shared.js",
      code: "",
      modules: {},
      imports: ["assets/viewer.js"],
    };
    expect(() => checkFlowentoBundle(bundle)).toThrow("only after the reader opens 3D");
  });
  it("rejects Three.js being merged into the app entry", () => {
    const bundle = fixture();
    bundle["assets/app.js"].modules["C:\\app\\node_modules\\three\\build\\three.module.js"] = {};
    expect(() => checkFlowentoBundle(bundle)).toThrow("only after the reader opens 3D");
  });
  it.each([
    ["model", 400001],
    ["poster", 80001],
  ])("rejects an oversized %s", (name, size) => {
    const bundle = fixture();
    bundle[name].source = new Uint8Array(size);
    expect(() => checkFlowentoBundle(bundle)).toThrow("budget exceeded");
  });
  it("rejects non-versioned or inlined model assets", () => {
    const bundle = fixture();
    bundle.model.fileName = "projects/flowento/mirror-frame-2025-10.glb";
    expect(() => checkFlowentoBundle(bundle)).toThrow("expected one content-hashed");
    delete bundle.model;
    expect(() => checkFlowentoBundle(bundle)).toThrow("expected one content-hashed");
  });
});
