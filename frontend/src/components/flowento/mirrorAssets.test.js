import { describe, expect, it } from "vitest";
import { readFileSync, statSync, existsSync } from "node:fs";

const asset = (name) => new URL(`../../assets/flowento/${name}`, import.meta.url);

describe("Flowento self-contained model assets", () => {
  for (const name of ["mirror-frame-2025-10.glb"]) {
    it(`${name} contains valid bounded geometry and no external resources`, () => {
      const binary = readFileSync(asset(name));
      expect(binary.length).toBeLessThan(400000);
      expect(binary.readUInt32LE(0)).toBe(0x46546c67);
      expect(binary.readUInt32LE(4)).toBe(2);
      expect(binary.readUInt32LE(8)).toBe(binary.length);
      const jsonLength = binary.readUInt32LE(12);
      const gltf = JSON.parse(binary.subarray(20, 20 + jsonLength).toString());
      expect(gltf.asset.version).toBe("2.0");
      expect(gltf.meshes.length).toBeGreaterThan(0);
      expect(gltf.buffers).toHaveLength(1);
      expect(gltf.buffers[0].uri).toBeUndefined();
      expect(gltf.images ?? []).toHaveLength(0);
      const binOffset = 20 + jsonLength;
      expect(binary.readUInt32LE(binOffset + 4)).toBe(0x004e4942);
      expect(binary.readUInt32LE(binOffset)).toBeGreaterThanOrEqual(gltf.buffers[0].byteLength);
      let triangles = 0;
      for (const mesh of gltf.meshes)
        for (const primitive of mesh.primitives) {
          const positions = gltf.accessors[primitive.attributes.POSITION];
          const indices = gltf.accessors[primitive.indices];
          expect(positions.count).toBeGreaterThan(0);
          expect(positions.min.every(Number.isFinite)).toBe(true);
          expect(positions.max.every(Number.isFinite)).toBe(true);
          expect(indices.count % 3).toBe(0);
          triangles += indices.count / 3;
        }
      expect(triangles).toBeGreaterThan(1000);
      expect(triangles).toBeLessThan(12000);
      for (const view of gltf.bufferViews) {
        expect(view.byteOffset + view.byteLength).toBeLessThanOrEqual(gltf.buffers[0].byteLength);
      }
    });
  }
  it("ships lightweight static previews for readers without WebGL", () => {
    for (const name of ["mirror-preview.png"]) {
      expect(readFileSync(asset(name)).subarray(1, 4).toString()).toBe("PNG");
      expect(statSync(asset(name)).size).toBeLessThan(80000);
    }
  });
  it("does not publish the retired original model or its preview", () => {
    expect(existsSync(asset("mirror-original-v3.glb"))).toBe(false);
    expect(existsSync(asset("mirror-original-preview.png"))).toBe(false);
    expect(
      existsSync(
        new URL("../../../public/projects/flowento/mirror-original-v3.glb", import.meta.url),
      ),
    ).toBe(false);
    expect(
      existsSync(
        new URL("../../../public/projects/flowento/mirror-frame-2025-10.glb", import.meta.url),
      ),
    ).toBe(false);
  });
});
