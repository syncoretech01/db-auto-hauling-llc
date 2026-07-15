import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import {
  clamp01,
  createDockAndPod,
  createHighway,
  createMaterials,
  createRig,
  createRoute,
  createYard,
  disposeObject,
  segment,
  smooth,
} from "./procedural.js";
import {
  STAGE_CONFIG,
  getStageAtProgress,
  resolveStage,
  sampleCamera,
} from "./stages.js";

const QUALITY_PRESETS = Object.freeze({
  low: Object.freeze({
    dpr: 1,
    shadows: false,
    shadowMapSize: 512,
    bloom: false,
    dustParticles: 30,
    roadsideInstances: 12,
    speedParticles: 10,
  }),
  mobile: Object.freeze({
    dpr: 1.2,
    shadows: false,
    shadowMapSize: 1024,
    bloom: false,
    dustParticles: 44,
    roadsideInstances: 16,
    speedParticles: 14,
  }),
  medium: Object.freeze({
    dpr: 1.25,
    shadows: true,
    shadowMapSize: 1024,
    bloom: false,
    dustParticles: 62,
    roadsideInstances: 22,
    speedParticles: 22,
  }),
  high: Object.freeze({
    dpr: 1.5,
    shadows: true,
    shadowMapSize: 2048,
    bloom: true,
    dustParticles: 84,
    roadsideInstances: 28,
    speedParticles: 30,
  }),
});

const DAWN = new THREE.Color(0x071017);
const MORNING = new THREE.Color(0x6d858e);
const DELIVERY_SKY = new THREE.Color(0x27343a);
const DAWN_SUN = new THREE.Color(0xff7a37);
const DAY_SUN = new THREE.Color(0xfff0d8);
const _cameraPosition = new THREE.Vector3();
const _cameraTarget = new THREE.Vector3();
const _skyColor = new THREE.Color();
const _sunColor = new THREE.Color();

function safeCall(callback, ...args) {
  if (typeof callback !== "function") return undefined;
  try {
    return callback(...args);
  } catch (error) {
    // Consumer callbacks should never break the render controller.
    if (typeof globalThis.reportError === "function") globalThis.reportError(error);
    else console.error(error);
    return undefined;
  }
}

function getCanvasSize(canvas, width, height) {
  const resolvedWidth = Math.max(1, Math.round(width ?? canvas.clientWidth ?? canvas.width ?? 1));
  const resolvedHeight = Math.max(1, Math.round(height ?? canvas.clientHeight ?? canvas.height ?? 1));
  return { width: resolvedWidth, height: resolvedHeight };
}

function resolveQualityName(requested, width) {
  if (requested === "desktop") return "high";
  if (requested === "performance") return "low";
  if (requested && requested !== "auto" && QUALITY_PRESETS[requested]) return requested;
  const memory = globalThis.navigator?.deviceMemory ?? 8;
  const cores = globalThis.navigator?.hardwareConcurrency ?? 8;
  if (width < 680) return memory <= 4 || cores <= 4 ? "low" : "mobile";
  if (memory <= 4 || cores <= 4) return "medium";
  return "high";
}

function createLights(scene) {
  const hemisphere = new THREE.HemisphereLight(0x96b9c4, 0x17120f, 1.15);
  scene.add(hemisphere);

  const key = new THREE.DirectionalLight(0xffd8b3, 4.4);
  key.name = "CinematicKeyLight";
  key.position.set(12, 17, 9);
  key.castShadow = true;
  key.shadow.camera.left = -22;
  key.shadow.camera.right = 22;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -12;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 55;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 2.4;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xff5f1e, 2.7);
  rim.name = "OrangeRimLight";
  rim.position.set(-11, 7, -9);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x7fb0c9, 1.15);
  fill.position.set(0, 8, 12);
  scene.add(fill);

  return { hemisphere, key, rim, fill };
}

/**
 * Creates the procedural pickup-to-delivery scene.
 *
 * @param {object} options
 * @param {HTMLCanvasElement} options.canvas Existing decorative canvas.
 * @param {"auto"|"low"|"mobile"|"medium"|"high"} [options.quality="auto"]
 * @param {(stage: object, previous: object|null, state: object) => void} [options.onStageChange]
 * @param {(progress: number, stage: object) => void} [options.onStageRequest]
 * @param {() => void} [options.onInvalidate]
 * @param {(event: Event) => void} [options.onContextLost]
 * @returns {{ready: Promise, setProgress: Function, goToStage: Function, setQuality: Function, resize: Function, update: Function, render: Function, destroy: Function}}
 */
export function createExperience(options = {}) {
  const { canvas } = options;
  if (!canvas || typeof canvas.getContext !== "function") {
    throw new TypeError("createExperience requires an existing canvas element.");
  }

  const initialSize = getCanvasSize(canvas, options.width, options.height);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: initialSize.width >= 680,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearAlpha(1);

  const scene = new THREE.Scene();
  scene.name = "OneHaulCinematicScene";
  scene.background = DAWN.clone();
  scene.fog = new THREE.FogExp2(DAWN.clone(), 0.027);

  const camera = new THREE.PerspectiveCamera(45, initialSize.width / initialSize.height, 0.1, 220);
  camera.name = "ScrollCamera";
  scene.add(camera);

  const materials = createMaterials();
  const lights = createLights(scene);
  const rig = createRig(materials);
  const yard = createYard(materials, QUALITY_PRESETS.high.dustParticles);
  const highway = createHighway(materials, {
    roadsideInstances: QUALITY_PRESETS.high.roadsideInstances,
    speedParticles: QUALITY_PRESETS.high.speedParticles,
  });
  const route = createRoute(materials);
  const delivery = createDockAndPod(materials);

  scene.add(yard.group, highway.group, route.group, delivery.group, rig.group);

  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(initialSize.width, initialSize.height),
    0.3,
    0.3,
    0.76,
  );
  const outputPass = new OutputPass();
  const composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  const state = {
    progress: 0,
    stage: STAGE_CONFIG[0],
    chapterIndex: 0,
    quality: "high",
    width: initialSize.width,
    height: initialSize.height,
    isMobile: initialSize.width < 680,
    isReady: false,
    isDestroyed: false,
    isContextLost: false,
    needsRender: true,
    activeMotion: true,
    isActive: true,
    elapsed: 0,
    delta: 0,
    lastUpdate: null,
  };

  let qualityPreset = QUALITY_PRESETS.high;
  let controller;

  function invalidate() {
    if (state.isDestroyed) return;
    state.needsRender = true;
    safeCall(options.onInvalidate, state);
  }

  function setCamera(progress) {
    sampleCamera(progress, state.isMobile, _cameraPosition, _cameraTarget);
    const drive = smooth(segment(progress, 0.45, 0.67));
    const driveExit = smooth(segment(progress, 0.63, 0.69));
    const shakeEnvelope = drive * (1 - driveExit);
    _cameraPosition.y += Math.sin(progress * 144) * 0.025 * shakeEnvelope;
    _cameraPosition.z += Math.sin(progress * 91) * 0.018 * shakeEnvelope;
    camera.position.copy(_cameraPosition);
    camera.lookAt(_cameraTarget);
  }

  function updateLighting(progress) {
    const day = smooth(segment(progress, 0.08, 0.7));
    const deliveryShade = smooth(segment(progress, 0.84, 1));
    _skyColor.copy(DAWN).lerp(MORNING, day).lerp(DELIVERY_SKY, deliveryShade * 0.72);
    scene.background.copy(_skyColor);
    scene.fog.color.copy(_skyColor);
    scene.fog.density = THREE.MathUtils.lerp(0.03, 0.017, day) + deliveryShade * 0.004;

    _sunColor.copy(DAWN_SUN).lerp(DAY_SUN, day);
    lights.key.color.copy(_sunColor);
    lights.key.intensity = THREE.MathUtils.lerp(3.2, 4.8, day);
    lights.hemisphere.intensity = THREE.MathUtils.lerp(0.72, 1.42, day);
    lights.rim.intensity = THREE.MathUtils.lerp(3.4, 1.15, day);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(0.92, 1.07, day);
  }

  function updateStageObjects(progress) {
    const hero = smooth(segment(progress, 0, 0.15));
    const loading = smooth(segment(progress, 0.15, 0.3));
    const securing = smooth(segment(progress, 0.3, 0.45));
    const moving = smooth(segment(progress, 0.45, 0.67));
    const moveExit = smooth(segment(progress, 0.64, 0.69));
    const communicating = smooth(segment(progress, 0.67, 0.84));
    const delivering = smooth(segment(progress, 0.84, 0.96));
    const signing = smooth(segment(progress, 0.94, 1));

    const speedEnvelope = moving * (1 - moveExit);
    const travelDistance = hero * 5 + moving * 105 + delivering * 14;
    const loadingImpact = Math.sin(smooth(segment(loading, 0.58, 1)) * Math.PI);

    rig.group.position.x = THREE.MathUtils.lerp(-3.1, 0, hero) + THREE.MathUtils.lerp(0.8, 0, delivering);
    rig.group.position.y = -loadingImpact * 0.1 + Math.sin(progress * 210) * speedEnvelope * 0.024;
    rig.group.rotation.z = Math.sin(progress * 170) * speedEnvelope * 0.0025;
    rig.updateWheels(-travelDistance / 0.61);

    rig.cargo.position.y = THREE.MathUtils.lerp(5.1, 0, loading);
    rig.cargo.rotation.x = Math.sin(loading * Math.PI) * 0.028;
    rig.cargo.rotation.z = Math.sin(loading * Math.PI * 2) * 0.018;
    yard.updateCrane(loading);
    yard.updateDust(loadingImpact, state.elapsed);

    rig.straps.visible = securing > 0.002 || progress > 0.3;
    rig.strapMeshes.forEach((strap, index) => {
      const strapIn = smooth(segment(securing, index * 0.12, 0.64 + index * 0.12));
      const looseness = THREE.MathUtils.lerp(1.17, 1, strapIn);
      strap.scale.y = looseness;
      strap.position.y = 1.43 * (1 - looseness);
      strap.material.opacity = strapIn;
    });
    rig.ratchets.forEach((ratchet, index) => {
      const ratchetIn = smooth(segment(securing, 0.52 + index * 0.08, 0.9 + index * 0.04));
      ratchet.scale.setScalar(Math.max(0.001, ratchetIn));
      ratchet.rotation.x = ratchetIn * Math.PI * 3.5;
    });

    yard.group.visible = progress < 0.49;
    yard.group.position.y = -smooth(segment(progress, 0.41, 0.49)) * 2.8;

    highway.group.visible = progress > 0.39 && progress < 0.93;
    highway.group.position.y = THREE.MathUtils.lerp(1.2, 0, smooth(segment(progress, 0.4, 0.47)))
      - smooth(segment(progress, 0.88, 0.93)) * 1.4;
    highway.updateRoad(travelDistance, speedEnvelope);

    route.group.visible = progress > 0.635;
    route.setReveal(communicating);
    route.group.position.y = smooth(segment(progress, 0.65, 0.7)) * 0.06;
    materials.route.opacity = THREE.MathUtils.lerp(0.92, 0.16, smooth(segment(progress, 0.86, 1)));
    materials.routeDim.opacity = THREE.MathUtils.lerp(0.28, 0.08, smooth(segment(progress, 0.86, 1)));
    rig.beacon.intensity = communicating * (1 - delivering) * 5.8;

    delivery.group.visible = progress > 0.79;
    delivery.group.position.x = THREE.MathUtils.lerp(-28, 0, smooth(segment(progress, 0.79, 0.9)));
    const podIn = smooth(segment(progress, 0.875, 0.96));
    delivery.pod.visible = podIn > 0.001;
    delivery.pod.scale.setScalar(Math.max(0.001, podIn));
    delivery.pod.position.set(
      THREE.MathUtils.lerp(-3.9, -5.4, podIn),
      THREE.MathUtils.lerp(1.45, 3.25, podIn),
      THREE.MathUtils.lerp(1.35, 3.45, podIn),
    );
    if (delivery.pod.visible) {
      delivery.pod.lookAt(camera.position);
      delivery.pod.rotation.z += THREE.MathUtils.lerp(-0.16, 0, podIn);
    }
    delivery.setDocumentProgress(signing);

    state.activeMotion = (
      (loading > 0.02 && loading < 0.99)
      || (speedEnvelope > 0.04)
      || (communicating > 0.02 && delivering < 0.95)
      || (podIn > 0.02 && signing < 0.99)
    );
  }

  function setProgress(progress) {
    if (state.isDestroyed) return state.progress;
    const nextProgress = clamp01(Number.isFinite(progress) ? progress : 0);
    const previousStage = state.stage;
    state.progress = nextProgress;
    state.stage = getStageAtProgress(nextProgress);
    state.chapterIndex = state.stage.chapterIndex;

    setCamera(nextProgress);
    updateLighting(nextProgress);
    updateStageObjects(nextProgress);

    if (previousStage?.id !== state.stage.id) {
      safeCall(options.onStageChange, state.stage, previousStage ?? null, state);
    }
    invalidate();
    return nextProgress;
  }

  function goToStage(stage) {
    const resolved = resolveStage(stage);
    if (!resolved || state.isDestroyed) return null;
    const requested = safeCall(options.onStageRequest, resolved.focus, resolved, state);
    if (typeof options.onStageRequest !== "function" || requested === false) {
      setProgress(resolved.focus);
    }
    return resolved.focus;
  }

  function resize(width, height, pixelRatio) {
    if (state.isDestroyed) return { width: state.width, height: state.height };
    const size = getCanvasSize(canvas, width, height);
    state.width = size.width;
    state.height = size.height;
    state.isMobile = size.width < 680 || size.width / size.height < 0.72;

    const deviceRatio = pixelRatio ?? globalThis.devicePixelRatio ?? 1;
    const ratio = Math.min(qualityPreset.dpr, Math.max(1, deviceRatio));
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.width, size.height, false);
    composer.setPixelRatio(ratio);
    composer.setSize(size.width, size.height);

    camera.aspect = size.width / size.height;
    camera.fov = state.isMobile ? 54 : 45;
    camera.updateProjectionMatrix();
    setCamera(state.progress);
    invalidate();
    return size;
  }

  function setQuality(tier = "auto") {
    if (state.isDestroyed) return state.quality;
    const qualityName = resolveQualityName(tier, state.width);
    qualityPreset = QUALITY_PRESETS[qualityName];
    state.quality = qualityName;

    renderer.shadowMap.enabled = qualityPreset.shadows;
    lights.key.castShadow = qualityPreset.shadows;
    lights.key.shadow.mapSize.setScalar(qualityPreset.shadowMapSize);
    if (lights.key.shadow.map) {
      lights.key.shadow.map.dispose();
      lights.key.shadow.map = null;
    }
    bloomPass.enabled = qualityPreset.bloom && !state.isMobile;
    route.glow.visible = qualityName !== "low";
    yard.dust.geometry.setDrawRange(0, qualityPreset.dustParticles);
    highway.posts.count = Math.min(highway.posts.instanceMatrix.count, qualityPreset.roadsideInstances);
    highway.streaks.count = Math.min(highway.streaks.instanceMatrix.count, qualityPreset.speedParticles);
    resize();
    invalidate();
    return qualityName;
  }

  function setActive(active = true) {
    if (state.isDestroyed) return false;
    const next = Boolean(active);
    if (state.isActive === next) return next;
    state.isActive = next;
    state.lastUpdate = null;
    if (next) invalidate();
    return next;
  }

  function update(elapsedSeconds = 0, deltaSeconds) {
    if (state.isDestroyed || state.isContextLost || !state.isActive) return false;
    const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
    const inferredDelta = state.lastUpdate === null ? 0 : elapsed - state.lastUpdate;
    const delta = Math.min(0.1, Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : inferredDelta));
    state.elapsed = elapsed;
    state.delta = delta;
    state.lastUpdate = elapsed;
    let animated = false;

    const loading = segment(state.progress, 0.15, 0.3);
    if (loading > 0.45 && loading < 1) {
      const impact = Math.sin(smooth(segment(loading, 0.58, 1)) * Math.PI);
      yard.updateDust(impact, state.elapsed);
      animated = impact > 0.01;
    }

    const communication = segment(state.progress, 0.67, 0.84);
    if (communication > 0.01 && state.progress < 0.94) {
      route.updatePulses(state.elapsed);
      rig.beacon.intensity *= 0.82 + (Math.sin(state.elapsed * 4.2) * 0.5 + 0.5) * 0.28;
      animated = true;
    }

    if (animated) invalidate();
    return animated;
  }

  function render(deltaSeconds = 0) {
    if (state.isDestroyed || state.isContextLost || !state.isActive) return false;
    if (bloomPass.enabled) composer.render(deltaSeconds);
    else renderer.render(scene, camera);
    state.needsRender = false;
    return true;
  }

  function handleContextLost(event) {
    if (state.isDestroyed) return;
    state.isContextLost = true;
    state.needsRender = false;
    safeCall(options.onContextLost, event, state);
  }

  function handleContextRestored(event) {
    if (state.isDestroyed) return;
    state.isContextLost = false;
    renderer.resetState();
    setQuality(state.quality);
    setProgress(state.progress);
    safeCall(options.onContextRestored, event, state);
  }

  canvas.addEventListener("webglcontextlost", handleContextLost, false);
  canvas.addEventListener("webglcontextrestored", handleContextRestored, false);

  function destroy() {
    if (state.isDestroyed) return;
    state.isDestroyed = true;
    state.isReady = false;
    state.needsRender = false;
    canvas.removeEventListener("webglcontextlost", handleContextLost, false);
    canvas.removeEventListener("webglcontextrestored", handleContextRestored, false);

    renderPass.dispose?.();
    bloomPass.dispose?.();
    outputPass.dispose?.();
    composer.dispose();
    disposeObject(scene);
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    safeCall(options.onDestroy, state);
  }

  controller = {
    ready: null,
    setProgress,
    goToStage,
    setQuality,
    setActive,
    resize,
    update,
    render,
    destroy,
    state,
    stages: STAGE_CONFIG,
    renderer,
    scene,
    camera,
    objects: Object.freeze({ rig, yard, highway, route, delivery, lights }),
  };

  controller.ready = Promise.resolve().then(async () => {
    if (state.isDestroyed) return controller;
    setQuality(options.quality ?? "auto");
    setProgress(options.initialProgress ?? 0);
    if (
      typeof renderer.compileAsync === "function"
      && renderer.extensions.has("KHR_parallel_shader_compile")
    ) {
      await renderer.compileAsync(scene, camera);
    } else {
      renderer.compile(scene, camera);
    }
    if (state.isDestroyed) return controller;
    render(0);
    state.isReady = true;
    invalidate();
    safeCall(options.onReady, controller);
    return controller;
  });

  return controller;
}

export { QUALITY_PRESETS, STAGE_CONFIG };

export default createExperience;
