import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createMirrorAssembly } from "./mirrorAssembly.js";
import { mirrorModel, mirrorStages } from "./mirrorModels.js";
import { resources } from "../../i18n/config.js";

async function load() {
  const bytes = readFileSync(
    new URL("../../assets/flowento/mirror-frame-2025-10.glb", import.meta.url),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  gltf.scene.scale.setScalar(7);
  gltf.scene.position.set(1, -2, 3);
  gltf.scene.updateWorldMatrix(true, true);
  return gltf.scene;
}

describe("Mirror assembly", () => {
  const definition = mirrorModel;
  const version = "current";
  {
    it(`${version} maps and translates every mesh exactly once`, async () => {
      const model = await load();
      const covered = new Set();
      for (const part of definition.parts) {
        for (const name of part.nodes) {
          const node = model.getObjectByName(name);
          expect(node, name).toBeTruthy();
          node.traverse((child) => {
            if (!child.isMesh) return;
            expect(covered.has(child)).toBe(false);
            covered.add(child);
          });
        }
        for (const locale of ["en", "cs"]) {
          expect(resources[locale].translation[part.label]).toBeTruthy();
          expect(resources[locale].translation[part.description]).toBeTruthy();
        }
      }
      const meshes = [];
      model.traverse((child) => {
        if (child.isMesh) meshes.push(child);
      });
      expect(covered.size).toBe(meshes.length);
      const assembly = createMirrorAssembly(model, definition.parts);
      expect(assembly.bounds().isEmpty()).toBe(false);
      for (const part of definition.parts)
        for (const name of part.nodes) {
          model.getObjectByName(name).traverse((child) => {
            if (child.isMesh) expect(child.material.color.getHexString()).toBe(part.color.slice(1));
          });
        }
    });
    it(`${version} separates in world space and reassembles without drift`, async () => {
      const model = await load();
      const entries = definition.parts.flatMap((part) =>
        part.nodes.map((name) => {
          const node = model.getObjectByName(name);
          return {
            node,
            original: node.position.clone(),
            world: node.getWorldPosition(new Vector3()),
            offset: part.motions.reduce(
              (sum, motion) => sum.add(new Vector3(...motion.offset)),
              new Vector3(),
            ),
          };
        }),
      );
      const assembly = createMirrorAssembly(model, definition.parts);
      assembly.separate(1);
      assembly.separate(1);
      for (const entry of entries) {
        const expected = entry.world.clone().add(entry.offset);
        expect(entry.node.getWorldPosition(new Vector3()).distanceTo(expected)).toBeLessThan(1e-6);
      }
      assembly.separate(0.35);
      assembly.separate(0);
      for (const entry of entries) expect(entry.node.position.equals(entry.original)).toBe(true);
      assembly.separate(NaN);
      for (const entry of entries) expect(entry.node.position.equals(entry.original)).toBe(true);
    });
    it(`${version} isolates one part and restores the complete assembly`, async () => {
      const model = await load();
      const assembly = createMirrorAssembly(model, definition.parts);
      const fullBounds = assembly.bounds();
      const selected = definition.parts.find((part) => part.id === "door");
      assembly.select(selected.id);
      for (const part of definition.parts)
        for (const name of part.nodes) {
          expect(model.getObjectByName(name).visible).toBe(part.id === selected.id);
        }
      expect(assembly.bounds().isEmpty()).toBe(false);
      expect(() => assembly.select("missing")).toThrow("Unknown mirror component");
      assembly.select(null);
      expect(assembly.bounds().equals(fullBounds)).toBe(true);
    });
  }
  it("has the requested five stages and a distinct housing door", () => {
    expect(mirrorStages.map((stage) => stage.id)).toEqual([
      "cover",
      "housing",
      "mounts",
      "inner",
      "mirror",
    ]);
    expect(mirrorModel.parts.find((part) => part.id === "door").nodes).toEqual([
      "Frame_component_2",
    ]);
    expect(mirrorModel.parts.find((part) => part.id === "frame").motions).toEqual([]);
  });

  // Expected world offsets are independent of the motion manifest implementation.
  it.each([
    [0, 0, 0, 0, 0, 0, 0],
    [0.1, 0.5, 0, 0, 0, 0, 0],
    [0.2, 1, 0, 0, 0, 0, 0],
    [0.25, 1, 0.5, 0, 0, 0, 0],
    [0.3, 1, 1, 0, 0, 0, 0],
    [0.35, 1, 1, 0.5, 0, 0, 0],
    [0.4, 1, 1, 1, 0, 0, 0],
    [0.5, 1, 1, 1, 0.5, 0, 0],
    [0.6, 1, 1, 1, 1, 0, 0],
    [0.7, 1, 1, 1, 1, 0.5, 0],
    [0.8, 1, 1, 1, 1, 1, 0],
    [0.9, 1, 1, 1, 1, 1, 0.5],
    [1, 1, 1, 1, 1, 1, 1],
  ])(
    "at %s only the appropriate components move, forwards and backwards",
    async (value, cover, door, housing, mounts, inner, mirror) => {
      const model = await load();
      const origins = new Map();
      model.traverse((object) => {
        if (object.isMesh) origins.set(object.name, object.getWorldPosition(new Vector3()));
      });
      const assembly = createMirrorAssembly(model, mirrorModel.parts);
      const housingOffset = new Vector3(0.35, -0.05, -1.7).multiplyScalar(housing);
      const expected = {
        cover: new Vector3(0, 0, -2.6 * cover),
        door: new Vector3(0, 0, -0.4 * door).add(housingOffset),
        housing: housingOffset,
        mounts: new Vector3(-0.3, 0.1, -1.15).multiplyScalar(mounts),
        inner: new Vector3(0, 0, -0.65 * inner),
        mirror: new Vector3(0, 0, 0.7 * mirror),
        frame: new Vector3(),
      };
      for (const initial of [0, 1]) {
        assembly.separate(initial);
        assembly.separate(value);
        for (const part of mirrorModel.parts)
          for (const name of part.nodes) {
            const position = model.getObjectByName(name).getWorldPosition(new Vector3());
            expect(
              position.distanceTo(origins.get(name).clone().add(expected[part.id])),
              name,
            ).toBeLessThan(1e-6);
          }
      }
    },
  );

  it("clamps invalid progress and fits every intermediate position inside the motion envelope", async () => {
    const model = await load();
    const assembly = createMirrorAssembly(model, mirrorModel.parts);
    const assembled = assembly.bounds();
    assembly.separate(-1);
    expect(assembly.bounds().equals(assembled)).toBe(true);
    assembly.separate(1);
    const separated = assembly.bounds();
    assembly.separate(5);
    expect(assembly.bounds().equals(separated)).toBe(true);
    const envelope = assembled.clone().union(separated).expandByScalar(1e-6);
    for (let percent = 0; percent <= 100; percent++) {
      assembly.separate(percent / 100);
      expect(envelope.containsBox(assembly.bounds())).toBe(true);
    }
    for (const invalid of [NaN, Infinity, -Infinity]) {
      assembly.separate(invalid);
      expect(assembly.bounds().equals(assembled)).toBe(true);
    }
  });
});
