import { Box3, Vector3 } from "three";

// Always derive transforms from the assembled pose: repeated slider changes cannot drift.
export function createMirrorAssembly(model, definitions) {
  model.updateWorldMatrix(true, true);
  const entries = definitions.map((part) => ({
    ...part,
    objects: part.nodes.map((name) => {
      const object = model.getObjectByName(name);
      if (!object?.parent) throw new Error("Missing mirror component: " + name);
      const motions = part.motions.map((motion) => {
        const origin = new Vector3().setFromMatrixPosition(object.parent.matrixWorld);
        const offset = object.parent.worldToLocal(origin.add(new Vector3(...motion.offset)));
        return { ...motion, offset };
      });
      return { object, position: object.position.clone(), motions };
    }),
  }));
  const sourceMaterials = new Set();
  for (const part of entries)
    for (const { object } of part.objects) {
      object.traverse((child) => {
        if (!child.isMesh) return;
        const recolor = (source) => {
          sourceMaterials.add(source);
          const material = source.clone();
          material.color.set(part.color);
          material.metalness = part.id === "mirror" ? 0.78 : 0.25;
          material.roughness = part.id === "mirror" ? 0.2 : 0.38;
          return material;
        };
        child.material = Array.isArray(child.material)
          ? child.material.map(recolor)
          : recolor(child.material);
      });
    }
  // Checked-in assets have no textures; each new material is owned by the scene cleanup.
  sourceMaterials.forEach((material) => material.dispose());
  return {
    separate(value) {
      const amount = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
      for (const part of entries)
        for (const entry of part.objects) {
          entry.object.position.copy(entry.position);
          for (const motion of entry.motions) {
            const progress = Math.min(
              1,
              Math.max(0, (amount - motion.start) / (motion.end - motion.start)),
            );
            // Smooth start/stop inside each stage; later parts remain completely still.
            const eased = progress * progress * (3 - 2 * progress);
            entry.object.position.addScaledVector(motion.offset, eased);
          }
        }
      model.updateWorldMatrix(true, true);
    },
    select(id) {
      if (id !== null && !entries.some((part) => part.id === id))
        throw new Error("Unknown mirror component");
      for (const part of entries)
        for (const { object } of part.objects) object.visible = id === null || part.id === id;
    },
    bounds() {
      model.updateWorldMatrix(true, true);
      const bounds = new Box3();
      model.traverseVisible((object) => {
        if (!object.isMesh) return;
        object.geometry.computeBoundingBox();
        bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
      });
      return bounds;
    },
  };
}
