import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { createMirrorAssembly } from "./mirrorAssembly.js";

// Loaded only after opting in. Rendering on changes avoids an idle animation loop.
export function mountMirrorScene(host, { url, parts, onReady, onError }) {
  let renderer, controls, observer, environment, model, assembly;
  let disposed = false;
  let distance = 4;
  let separation = 0;
  let selectedPart = null;
  let assemblyEnvelope;
  const request = new AbortController();
  const timeout = setTimeout(() => request.abort(), 20000);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

  function releaseModel(object) {
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    object?.traverse((child) => {
      if (child.geometry) geometries.add(child.geometry);
      for (const material of Array.isArray(child.material)
        ? child.material
        : child.material
          ? [child.material]
          : []) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach((value) => value.dispose());
    textures.forEach((value) => value.dispose());
    materials.forEach((value) => value.dispose());
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(timeout);
    request.abort();
    observer?.disconnect();
    controls?.dispose();
    releaseModel(model);
    environment?.dispose();
    if (renderer) {
      renderer.domElement.removeEventListener("webglcontextlost", fail);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
  }
  function fail(event) {
    event?.preventDefault?.();
    if (disposed) return;
    dispose();
    onError();
  }
  function render() {
    if (!disposed) renderer.render(scene, camera);
  }
  function view(name) {
    if (!model || disposed) return;
    const direction = name === "front" ? [0, 0, 1] : name === "back" ? [0, 0, -1] : [1.05, 0.32, 1];
    camera.position
      .set(...direction)
      .normalize()
      .multiplyScalar(distance)
      .add(controls.target);
    controls.update();
    render();
  }
  function fit() {
    if (!assembly || disposed) return;
    // Fit the whole motion envelope once, not on every animation frame.
    // This keeps the stationary frame from appearing to drift while parts move.
    const bounds = selectedPart === null && separation > 0 ? assemblyEnvelope : assembly.bounds();
    const center = bounds.getCenter(new THREE.Vector3());
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const limitingFov = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect));
    distance = (sphere.radius / Math.sin(limitingFov)) * 1.1;
    const direction = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    controls.minDistance = distance * 0.55;
    controls.maxDistance = distance * 2.2;
    controls.update();
  }
  function resize() {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (assembly) fit();
    render();
  }
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    host.appendChild(renderer.domElement);
    renderer.domElement.addEventListener("webglcontextlost", fail);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = false;
    controls.rotateSpeed = 0.65;
    controls.addEventListener("change", render);
    camera.position.set(0, 0, distance);
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(renderer);
    environment = generator.fromScene(room);
    scene.environment = environment.texture;
    room.dispose();
    generator.dispose();
    scene.add(new THREE.HemisphereLight(0xe2f4ff, 0x667577, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1);
    key.position.set(3, 4, 5);
    scene.add(key);
    observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    fetch(url, { signal: request.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Model unavailable");
        return response.arrayBuffer();
      })
      .then((data) => {
        if (disposed) return null;
        return new GLTFLoader().parseAsync(data, "");
      })
      .then((gltf) => {
        if (!gltf) return;
        clearTimeout(timeout);
        if (disposed) {
          releaseModel(gltf.scene);
          return;
        }
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const height = box.getSize(new THREE.Vector3()).y;
        if (!Number.isFinite(height) || height <= 0) throw new Error("Invalid model dimensions");
        model.scale.multiplyScalar(2.6 / height);
        model.position.sub(new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()));
        scene.add(model);
        assembly = createMirrorAssembly(model, parts);
        assemblyEnvelope = assembly.bounds();
        assembly.separate(1);
        assemblyEnvelope.union(assembly.bounds());
        assembly.separate(0);
        resize();
        view("angle");
        onReady();
      })
      .catch(() => {
        if (!disposed) fail();
      });
  } catch {
    fail();
  }
  return {
    dispose,
    view,
    separate(amount) {
      if (!assembly || disposed) return;
      const starting = separation === 0 && amount > 0;
      const finishing = separation > 0 && amount === 0;
      separation = amount;
      assembly.separate(amount);
      if (starting || finishing) fit();
      render();
    },
    selectPart(id) {
      if (!assembly || disposed) return;
      selectedPart = id;
      assembly.select(id);
      fit();
      view("angle");
      render();
    },
    zoom(factor) {
      if (!model || disposed) return;
      const offset = camera.position.clone().sub(controls.target);
      const target = THREE.MathUtils.clamp(
        offset.length() * factor,
        controls.minDistance,
        controls.maxDistance,
      );
      camera.position.copy(controls.target).add(offset.setLength(target));
      controls.update();
      render();
    },
  };
}
