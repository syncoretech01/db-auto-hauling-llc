import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _dummy = new THREE.Object3D();
const _quaternionA = new THREE.Quaternion();
const _quaternionB = new THREE.Quaternion();

export const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function segment(value, start, end) {
  return clamp01((value - start) / Math.max(0.00001, end - start));
}

export function smooth(value) {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

export function smoother(value) {
  const x = clamp01(value);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function wrap(value, min, max) {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

function box(width, height, depth, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
}

function cylinder(radiusTop, radiusBottom, height, segments, material) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  );
}

function setShadow(mesh, cast = false, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function mergeStaticMeshes(group, namePrefix) {
  const buckets = new Map();

  group.children.forEach((child) => {
    if (!child.isMesh || child.isInstancedMesh || Array.isArray(child.material)) return;
    const key = child.material.uuid;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(child);
  });

  buckets.forEach((meshes, key) => {
    if (meshes.length < 2) return;
    const transformed = meshes.map((mesh) => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      return geometry;
    });
    const geometry = mergeGeometries(transformed, false);
    transformed.forEach((item) => item.dispose());
    if (!geometry) return;

    const merged = new THREE.Mesh(geometry, meshes[0].material);
    merged.name = `${namePrefix}-${key.slice(0, 6)}`;
    merged.castShadow = meshes.some((mesh) => mesh.castShadow);
    merged.receiveShadow = meshes.some((mesh) => mesh.receiveShadow);
    group.add(merged);

    const sourceGeometries = new Set();
    meshes.forEach((mesh) => {
      group.remove(mesh);
      sourceGeometries.add(mesh.geometry);
    });
    sourceGeometries.forEach((item) => item.dispose());
  });
}

export function createMaterials() {
  const materials = {
    blackPaint: new THREE.MeshPhysicalMaterial({
      color: 0x080a0c,
      metalness: 0.82,
      roughness: 0.24,
      clearcoat: 0.78,
      clearcoatRoughness: 0.2,
    }),
    blackTrim: new THREE.MeshStandardMaterial({
      color: 0x11161a,
      metalness: 0.5,
      roughness: 0.54,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      color: 0x1e2529,
      metalness: 0.82,
      roughness: 0.42,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: 0x707b80,
      metalness: 0.9,
      roughness: 0.32,
    }),
    brushedSteel: new THREE.MeshStandardMaterial({
      color: 0x9ca5a7,
      metalness: 0.9,
      roughness: 0.24,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: 0x050607,
      metalness: 0.05,
      roughness: 0.92,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x29414c,
      metalness: 0.15,
      roughness: 0.12,
      transmission: 0.18,
      transparent: true,
      opacity: 0.86,
    }),
    orange: new THREE.MeshStandardMaterial({
      color: 0xff641f,
      emissive: 0x6e1700,
      emissiveIntensity: 1.15,
      metalness: 0.34,
      roughness: 0.34,
    }),
    orangeGlow: new THREE.MeshBasicMaterial({
      color: 0xff7130,
      transparent: true,
      opacity: 0.88,
      toneMapped: false,
    }),
    headlight: new THREE.MeshStandardMaterial({
      color: 0xfff1d2,
      emissive: 0xffc775,
      emissiveIntensity: 5.5,
      roughness: 0.22,
      toneMapped: false,
    }),
    tailLight: new THREE.MeshStandardMaterial({
      color: 0x8e0e08,
      emissive: 0xff2515,
      emissiveIntensity: 2.5,
      roughness: 0.3,
      toneMapped: false,
    }),
    cargo: new THREE.MeshStandardMaterial({
      color: 0x626c70,
      metalness: 0.92,
      roughness: 0.36,
    }),
    cargoDark: new THREE.MeshStandardMaterial({
      color: 0x2e393e,
      metalness: 0.86,
      roughness: 0.44,
    }),
    timber: new THREE.MeshStandardMaterial({
      color: 0x7a4d2b,
      metalness: 0,
      roughness: 0.82,
    }),
    asphalt: new THREE.MeshStandardMaterial({
      color: 0x14181b,
      metalness: 0.05,
      roughness: 0.98,
    }),
    asphaltLight: new THREE.MeshStandardMaterial({
      color: 0x262b2c,
      metalness: 0,
      roughness: 1,
    }),
    lane: new THREE.MeshStandardMaterial({
      color: 0xd8d2bc,
      emissive: 0x4c4531,
      emissiveIntensity: 0.25,
      roughness: 0.75,
    }),
    concrete: new THREE.MeshStandardMaterial({
      color: 0x64686a,
      metalness: 0.05,
      roughness: 0.94,
    }),
    concreteDark: new THREE.MeshStandardMaterial({
      color: 0x2c3133,
      metalness: 0.12,
      roughness: 0.86,
    }),
    building: new THREE.MeshStandardMaterial({
      color: 0x20272b,
      metalness: 0.5,
      roughness: 0.66,
    }),
    buildingLight: new THREE.MeshStandardMaterial({
      color: 0x9b7656,
      emissive: 0xff9a48,
      emissiveIntensity: 1.8,
      roughness: 0.6,
    }),
    paper: new THREE.MeshStandardMaterial({
      color: 0xebe6d8,
      metalness: 0,
      roughness: 0.74,
    }),
    ink: new THREE.MeshBasicMaterial({
      color: 0x1e292e,
      toneMapped: false,
    }),
    route: new THREE.MeshBasicMaterial({
      color: 0xff6422,
      transparent: true,
      opacity: 0.92,
      toneMapped: false,
    }),
    routeDim: new THREE.MeshBasicMaterial({
      color: 0xff8a52,
      transparent: true,
      opacity: 0.28,
      toneMapped: false,
      depthWrite: false,
    }),
    speed: new THREE.MeshBasicMaterial({
      color: 0xff8a52,
      transparent: true,
      opacity: 0.18,
      toneMapped: false,
      depthWrite: false,
    }),
    dust: new THREE.PointsMaterial({
      color: 0xd28c53,
      size: 0.12,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  };

  return materials;
}

export function createRig(materials) {
  const group = new THREE.Group();
  group.name = "CinematicRig";

  const truck = new THREE.Group();
  truck.name = "BlackDually";
  group.add(truck);

  const chassis = setShadow(box(6.4, 0.25, 1.65, materials.darkSteel));
  chassis.position.set(2.05, 0.92, 0);
  truck.add(chassis);

  const lowerBody = setShadow(box(5.65, 0.72, 2.05, materials.blackPaint), true, true);
  lowerBody.position.set(2.1, 1.23, 0);
  truck.add(lowerBody);

  const hood = setShadow(box(2.15, 0.72, 2.12, materials.blackPaint), true, true);
  hood.position.set(4.18, 1.78, 0);
  hood.rotation.z = -0.035;
  truck.add(hood);

  const grille = box(0.13, 0.7, 1.78, materials.brushedSteel);
  grille.position.set(5.29, 1.62, 0);
  truck.add(grille);

  const cab = setShadow(box(2.25, 1.78, 2.08, materials.blackPaint), true, true);
  cab.position.set(2.23, 2.15, 0);
  truck.add(cab);

  const roof = setShadow(box(2.38, 0.16, 2.14, materials.blackPaint));
  roof.position.set(2.2, 3.08, 0);
  truck.add(roof);

  const windshield = box(0.11, 0.83, 1.76, materials.glass);
  windshield.position.set(3.39, 2.39, 0);
  windshield.rotation.z = -0.08;
  truck.add(windshield);

  for (const z of [-1.05, 1.05]) {
    const sideWindow = box(1.25, 0.69, 0.07, materials.glass);
    sideWindow.position.set(2.32, 2.43, z);
    truck.add(sideWindow);

    const mirrorArm = cylinder(0.025, 0.025, 0.3, 8, materials.darkSteel);
    mirrorArm.rotation.x = Math.PI / 2;
    mirrorArm.position.set(3.05, 2.48, z * 1.08);
    truck.add(mirrorArm);

    const mirror = box(0.25, 0.38, 0.1, materials.blackTrim);
    mirror.position.set(3.05, 2.5, z * 1.2);
    truck.add(mirror);
  }

  const bedFloor = setShadow(box(2.35, 0.18, 2.12, materials.blackPaint), true, true);
  bedFloor.position.set(0.02, 1.55, 0);
  truck.add(bedFloor);

  for (const z of [-1.03, 1.03]) {
    const bedRail = setShadow(box(2.35, 0.66, 0.12, materials.blackPaint));
    bedRail.position.set(0.02, 1.81, z);
    truck.add(bedRail);
  }

  const tailgate = setShadow(box(0.13, 0.68, 2.12, materials.blackPaint));
  tailgate.position.set(-1.16, 1.8, 0);
  truck.add(tailgate);

  for (const z of [-0.72, 0.72]) {
    const lamp = box(0.15, 0.28, 0.3, materials.headlight);
    lamp.position.set(5.37, 1.81, z);
    truck.add(lamp);

    const rearLamp = box(0.15, 0.3, 0.32, materials.tailLight);
    rearLamp.position.set(-1.24, 1.77, z);
    truck.add(rearLamp);
  }

  const bumper = box(0.18, 0.25, 2.18, materials.brushedSteel);
  bumper.position.set(5.4, 1.1, 0);
  truck.add(bumper);

  const exhaust = cylinder(0.1, 0.12, 1.55, 12, materials.darkSteel);
  exhaust.position.set(0.85, 2.18, -1.03);
  truck.add(exhaust);

  const trailer = new THREE.Group();
  trailer.name = "GooseneckTrailer";
  group.add(trailer);

  const deck = setShadow(box(10.7, 0.23, 2.55, materials.darkSteel), true, true);
  deck.position.set(-6.25, 1.22, 0);
  trailer.add(deck);

  const deckSurface = setShadow(box(9.95, 0.1, 2.38, materials.timber), false, true);
  deckSurface.position.set(-6.55, 1.38, 0);
  trailer.add(deckSurface);

  for (const z of [-1.26, 1.26]) {
    const rail = setShadow(box(10.65, 0.25, 0.12, materials.darkSteel));
    rail.position.set(-6.25, 1.08, z);
    trailer.add(rail);
  }

  const neckDeck = setShadow(box(2.55, 0.25, 2.42, materials.darkSteel));
  neckDeck.position.set(-0.3, 2.34, 0);
  trailer.add(neckDeck);

  for (const z of [-1.05, 1.05]) {
    const neckBeam = setShadow(box(2.5, 0.19, 0.18, materials.darkSteel));
    neckBeam.position.set(-1.14, 1.86, z);
    neckBeam.rotation.z = -0.42;
    trailer.add(neckBeam);
  }

  const hitch = cylinder(0.12, 0.16, 0.58, 10, materials.brushedSteel);
  hitch.position.set(0.55, 1.99, 0);
  trailer.add(hitch);

  const rearRamp = setShadow(box(1.75, 0.13, 1.1, materials.darkSteel));
  rearRamp.position.set(-12.15, 0.85, -0.65);
  rearRamp.rotation.z = 0.18;
  trailer.add(rearRamp);
  const rearRampTwo = rearRamp.clone();
  rearRampTwo.position.z = 0.65;
  trailer.add(rearRampTwo);

  const wheelSpecs = [
    [3.75, 0.66, -1.08], [3.75, 0.66, 1.08],
    [0.28, 0.66, -1.02], [0.28, 0.66, -1.34],
    [0.28, 0.66, 1.02], [0.28, 0.66, 1.34],
    [-7.35, 0.66, -1.22], [-7.35, 0.66, 1.22],
    [-8.75, 0.66, -1.22], [-8.75, 0.66, 1.22],
  ];

  const tireGeometry = new THREE.CylinderGeometry(0.61, 0.61, 0.3, 24, 1);
  const hubGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.315, 16, 1);
  const tires = new THREE.InstancedMesh(tireGeometry, materials.rubber, wheelSpecs.length);
  const hubs = new THREE.InstancedMesh(hubGeometry, materials.brushedSteel, wheelSpecs.length);
  tires.name = "InstancedTires";
  hubs.name = "InstancedHubs";
  tires.castShadow = true;
  tires.receiveShadow = true;
  hubs.castShadow = true;
  group.add(tires, hubs);

  function updateWheels(roll = 0) {
    _quaternionA.setFromAxisAngle(X_AXIS, Math.PI / 2);
    _quaternionB.setFromAxisAngle(Z_AXIS, roll);
    _quaternionB.multiply(_quaternionA);

    wheelSpecs.forEach((position, index) => {
      _dummy.position.fromArray(position);
      _dummy.quaternion.copy(_quaternionB);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      tires.setMatrixAt(index, _dummy.matrix);
      hubs.setMatrixAt(index, _dummy.matrix);
    });
    tires.instanceMatrix.needsUpdate = true;
    hubs.instanceMatrix.needsUpdate = true;
  }
  updateWheels();

  const cargo = new THREE.Group();
  cargo.name = "FreightLoad";
  group.add(cargo);

  const cradleA = setShadow(box(0.22, 0.3, 2.2, materials.timber));
  cradleA.position.set(-4.55, 1.65, 0);
  cargo.add(cradleA);
  const cradleB = cradleA.clone();
  cradleB.position.x = -7.85;
  cargo.add(cradleB);

  const beamGeometry = new THREE.BoxGeometry(5.6, 0.34, 0.34);
  const beams = new THREE.InstancedMesh(beamGeometry, materials.cargo, 9);
  beams.name = "StructuralSteelCargo";
  beams.castShadow = true;
  beams.receiveShadow = true;
  let beamIndex = 0;
  for (let level = 0; level < 3; level += 1) {
    for (let row = 0; row < 3; row += 1) {
      _dummy.position.set(-6.2, 1.78 + level * 0.37, (row - 1) * 0.42);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1 - level * 0.06, 1, 1);
      _dummy.updateMatrix();
      beams.setMatrixAt(beamIndex, _dummy.matrix);
      beamIndex += 1;
    }
  }
  beams.instanceMatrix.needsUpdate = true;
  cargo.add(beams);

  for (const x of [-8.7, -3.7]) {
    const endCap = setShadow(box(0.13, 1.15, 1.5, materials.cargoDark));
    endCap.position.set(x, 2.16, 0);
    cargo.add(endCap);
  }

  const straps = new THREE.Group();
  straps.name = "SecurementStraps";
  group.add(straps);
  const strapMeshes = [];
  const ratchets = [];

  for (const x of [-4.5, -6.15, -7.8]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 1.43, -1.28),
      new THREE.Vector3(x, 2.96, -0.78),
      new THREE.Vector3(x, 3.04, 0),
      new THREE.Vector3(x, 2.96, 0.78),
      new THREE.Vector3(x, 1.43, 1.28),
    ]);
    const geometry = new THREE.TubeGeometry(curve, 20, 0.035, 5, false);
    const strapMaterial = materials.orange.clone();
    strapMaterial.transparent = true;
    strapMaterial.opacity = 0;
    const strap = new THREE.Mesh(geometry, strapMaterial);
    strap.castShadow = true;
    straps.add(strap);
    strapMeshes.push(strap);

    const ratchet = box(0.28, 0.17, 0.15, materials.brushedSteel);
    ratchet.position.set(x, 1.56, 1.34);
    ratchet.castShadow = true;
    straps.add(ratchet);
    ratchets.push(ratchet);
  }

  const beacon = new THREE.PointLight(0xff5f1f, 0, 7, 2);
  beacon.position.set(-2, 4, 0);
  group.add(beacon);

  mergeStaticMeshes(truck, "TruckShell");
  mergeStaticMeshes(trailer, "TrailerFrame");

  return {
    group,
    truck,
    trailer,
    cargo,
    straps,
    strapMeshes,
    ratchets,
    tires,
    hubs,
    beacon,
    strapMaterials: strapMeshes.map((strap) => strap.material),
    updateWheels,
  };
}

export function createYard(materials, particleCount = 72) {
  const group = new THREE.Group();
  group.name = "MontgomeryLoadingYard";

  const ground = setShadow(box(64, 0.12, 42, materials.concreteDark), false, true);
  ground.position.set(-2, -0.13, 0);
  group.add(ground);

  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildings = new THREE.InstancedMesh(buildingGeometry, materials.building, 6);
  buildings.receiveShadow = true;
  buildings.castShadow = true;
  const buildingSpecs = [
    [-15, 3.5, -12, 18, 7, 6],
    [8, 2.7, -13.5, 16, 5.4, 4],
    [22, 2.2, -10, 7, 4.4, 7],
    [-22, 2.1, 11, 8, 4.2, 6],
    [18, 1.8, 13, 9, 3.6, 5],
    [-7, 1.6, 15, 11, 3.2, 4],
  ];
  buildingSpecs.forEach(([x, y, z, sx, sy, sz], index) => {
    _dummy.position.set(x, y, z);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(sx, sy, sz);
    _dummy.updateMatrix();
    buildings.setMatrixAt(index, _dummy.matrix);
  });
  buildings.instanceMatrix.needsUpdate = true;
  group.add(buildings);

  const lampGeometry = new THREE.SphereGeometry(0.12, 8, 6);
  const lamps = new THREE.InstancedMesh(lampGeometry, materials.buildingLight, 8);
  const lampPositions = [
    [-16, 5.8, -8.8], [-10, 5.8, -8.8], [4, 4.4, -11.2], [11, 4.4, -11.2],
    [20, 3.8, -6.4], [-20, 3.7, 8], [15, 3.2, 10.4], [-4, 3, 12.8],
  ];
  lampPositions.forEach((position, index) => {
    _dummy.position.fromArray(position);
    _dummy.scale.setScalar(1);
    _dummy.rotation.set(0, 0, 0);
    _dummy.updateMatrix();
    lamps.setMatrixAt(index, _dummy.matrix);
  });
  lamps.instanceMatrix.needsUpdate = true;
  group.add(lamps);

  const crane = new THREE.Group();
  crane.name = "LoadingCrane";
  const craneMast = setShadow(box(0.35, 8, 0.35, materials.orange));
  craneMast.position.set(-10.2, 4, -2.7);
  crane.add(craneMast);
  const craneBeam = setShadow(box(7.1, 0.35, 0.35, materials.orange));
  craneBeam.position.set(-6.85, 7.75, -2.7);
  crane.add(craneBeam);
  const trolley = setShadow(box(0.65, 0.42, 0.58, materials.darkSteel));
  trolley.position.set(-5.7, 7.47, -2.7);
  crane.add(trolley);

  const cable = cylinder(0.024, 0.024, 1, 6, materials.darkSteel);
  cable.position.set(-5.7, 6.1, -2.7);
  crane.add(cable);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.05, 7, 12, Math.PI * 1.4), materials.orange);
  hook.position.set(-5.7, 5.3, -2.7);
  hook.rotation.z = Math.PI * 0.15;
  crane.add(hook);
  group.add(crane);

  const coneGeometry = new THREE.ConeGeometry(0.16, 0.48, 8);
  const cones = new THREE.InstancedMesh(coneGeometry, materials.orange, 7);
  for (let index = 0; index < 7; index += 1) {
    _dummy.position.set(-10 + index * 3.25, 0.24, 4.5 + (index % 2) * 0.55);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.setScalar(1);
    _dummy.updateMatrix();
    cones.setMatrixAt(index, _dummy.matrix);
  }
  cones.instanceMatrix.needsUpdate = true;
  cones.castShadow = true;
  group.add(cones);

  const dustPositions = new Float32Array(particleCount * 3);
  const dustSeeds = [];
  for (let index = 0; index < particleCount; index += 1) {
    const seed = {
      angle: index * 2.39996,
      radius: 0.3 + ((index * 17) % particleCount) / particleCount * 4.2,
      lift: ((index * 29) % particleCount) / particleCount,
      drift: 0.4 + ((index * 11) % particleCount) / particleCount,
    };
    dustSeeds.push(seed);
    dustPositions[index * 3] = -5.8;
    dustPositions[index * 3 + 1] = 0;
    dustPositions[index * 3 + 2] = 0;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, materials.dust);
  dust.name = "LoadingDust";
  group.add(dust);

  function updateCrane(cargoLift) {
    const hookY = THREE.MathUtils.lerp(6.85, 3.45, smooth(cargoLift));
    const cableTop = 7.25;
    const length = Math.max(0.2, cableTop - hookY);
    hook.position.y = hookY;
    cable.position.y = hookY + length * 0.5;
    cable.scale.y = length;
  }

  function updateDust(amount, time = 0) {
    const positions = dust.geometry.attributes.position.array;
    dustSeeds.forEach((seed, index) => {
      const expansion = seed.radius * (0.35 + amount * 1.2);
      const phase = seed.angle + time * 0.22 * seed.drift;
      positions[index * 3] = -6.1 + Math.cos(phase) * expansion;
      positions[index * 3 + 1] = 0.12 + seed.lift * amount * 1.35;
      positions[index * 3 + 2] = Math.sin(phase) * expansion * 0.55;
    });
    dust.geometry.attributes.position.needsUpdate = true;
    dust.material.opacity = Math.sin(clamp01(amount) * Math.PI) * 0.42;
  }

  return { group, crane, cable, hook, dust, updateCrane, updateDust };
}

export function createHighway(materials, quality = {}) {
  const group = new THREE.Group();
  group.name = "RecyclableHighway";

  const road = setShadow(box(180, 0.16, 12, materials.asphalt), false, true);
  road.position.y = -0.15;
  group.add(road);

  for (const z of [-6.15, 6.15]) {
    const shoulder = setShadow(box(180, 0.08, 1.25, materials.asphaltLight), false, true);
    shoulder.position.set(0, -0.09, z);
    group.add(shoulder);
  }

  const dashCount = 34;
  const dashSpacing = 5.5;
  const dashGeometry = new THREE.BoxGeometry(2.6, 0.035, 0.14);
  const dashes = new THREE.InstancedMesh(dashGeometry, materials.lane, dashCount);
  dashes.name = "RecycledLaneDashes";
  const dashBases = Array.from({ length: dashCount }, (_, index) => (index - dashCount / 2) * dashSpacing);
  group.add(dashes);

  const postCount = quality.roadsideInstances ?? 24;
  const postGeometry = new THREE.BoxGeometry(0.12, 1.05, 0.12);
  const posts = new THREE.InstancedMesh(postGeometry, materials.concrete, postCount);
  posts.name = "RecycledRoadsidePosts";
  const postBases = Array.from({ length: postCount }, (_, index) => ({
    x: (index - postCount / 2) * 7.2,
    z: index % 2 ? -7.2 : 7.2,
    scale: 0.78 + (index % 5) * 0.07,
  }));
  posts.castShadow = true;
  group.add(posts);

  const streakCount = quality.speedParticles ?? 24;
  const streakGeometry = new THREE.BoxGeometry(1.8, 0.025, 0.025);
  const streaks = new THREE.InstancedMesh(streakGeometry, materials.speed, streakCount);
  streaks.name = "SpeedStreaks";
  const streakSeeds = Array.from({ length: streakCount }, (_, index) => ({
    x: (index * 7.81) % 115 - 57.5,
    y: 0.22 + ((index * 13) % 15) * 0.12,
    z: ((index * 19) % 100) / 100 * 11 - 5.5,
    scale: 0.4 + (index % 6) * 0.13,
  }));
  group.add(streaks);

  function updateRoad(distance, speedAmount) {
    dashBases.forEach((base, index) => {
      _dummy.position.set(wrap(base - distance, -92, 92), -0.035, 0);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      dashes.setMatrixAt(index, _dummy.matrix);
    });
    dashes.instanceMatrix.needsUpdate = true;

    postBases.forEach((item, index) => {
      _dummy.position.set(wrap(item.x - distance * 0.88, -94, 94), 0.45, item.z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, item.scale, 1);
      _dummy.updateMatrix();
      posts.setMatrixAt(index, _dummy.matrix);
    });
    posts.instanceMatrix.needsUpdate = true;

    streakSeeds.forEach((item, index) => {
      _dummy.position.set(wrap(item.x - distance * 1.4, -68, 68), item.y, item.z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(item.scale * (0.3 + speedAmount * 1.8), 1, 1);
      _dummy.updateMatrix();
      streaks.setMatrixAt(index, _dummy.matrix);
    });
    streaks.instanceMatrix.needsUpdate = true;
    streaks.visible = speedAmount > 0.08;
    materials.speed.opacity = 0.06 + speedAmount * 0.26;
  }

  updateRoad(0, 0);
  return { group, road, dashes, posts, streaks, updateRoad };
}

export function createRoute(materials) {
  const group = new THREE.Group();
  group.name = "CommunicationRoute";

  const points = [
    new THREE.Vector3(-20, 0.08, -2.4),
    new THREE.Vector3(-14, 0.09, 2.1),
    new THREE.Vector3(-7, 0.1, -1.1),
    new THREE.Vector3(0, 0.11, 2.6),
    new THREE.Vector3(7, 0.12, -2.2),
    new THREE.Vector3(15, 0.13, 1.6),
    new THREE.Vector3(23, 0.14, 0),
  ];
  const curve = new THREE.CatmullRomCurve3(points);
  const ribbonGeometry = new THREE.TubeGeometry(curve, 96, 0.075, 6, false);
  const ribbon = new THREE.Mesh(ribbonGeometry, materials.route);
  ribbon.name = "RouteRibbon";
  ribbon.frustumCulled = false;
  group.add(ribbon);

  const glowGeometry = new THREE.TubeGeometry(curve, 96, 0.18, 6, false);
  const glow = new THREE.Mesh(glowGeometry, materials.routeDim);
  glow.name = "RouteRibbonGlow";
  glow.frustumCulled = false;
  group.add(glow);

  const indexCount = ribbonGeometry.index?.count ?? ribbonGeometry.attributes.position.count;
  const glowIndexCount = glowGeometry.index?.count ?? glowGeometry.attributes.position.count;

  const milestones = [0.14, 0.34, 0.55, 0.75, 0.94].map((amount, index) => {
    const marker = new THREE.Group();
    marker.name = `RouteMilestone${index + 1}`;
    const position = curve.getPointAt(amount);
    marker.position.copy(position);

    const pin = cylinder(0.07, 0.07, 0.72, 8, materials.orange);
    pin.position.y = 0.36;
    marker.add(pin);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), materials.orangeGlow);
    cap.position.y = 0.77;
    marker.add(cap);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.024, 6, 24), materials.routeDim);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    marker.add(ring);
    marker.userData = { amount, ring, cap };
    group.add(marker);
    return marker;
  });

  function setReveal(amount) {
    const value = clamp01(amount);
    ribbon.geometry.setDrawRange(0, Math.floor((indexCount * value) / 3) * 3);
    glow.geometry.setDrawRange(0, Math.floor((glowIndexCount * value) / 3) * 3);
    milestones.forEach((marker) => {
      const markerIn = smooth(segment(value, marker.userData.amount - 0.08, marker.userData.amount + 0.02));
      marker.visible = markerIn > 0.001;
      marker.scale.setScalar(Math.max(0.001, markerIn));
    });
  }

  function updatePulses(time) {
    milestones.forEach((marker, index) => {
      if (!marker.visible) return;
      const pulse = 1 + (Math.sin(time * 2.8 - index * 0.9) * 0.5 + 0.5) * 0.65;
      marker.userData.ring.scale.setScalar(pulse);
      marker.userData.cap.scale.setScalar(0.92 + pulse * 0.08);
    });
  }

  setReveal(0);
  return { group, curve, ribbon, glow, milestones, setReveal, updatePulses };
}

export function createDockAndPod(materials) {
  const group = new THREE.Group();
  group.name = "ReceivingDock";

  const warehouse = setShadow(box(1.1, 9, 19, materials.building), true, true);
  warehouse.position.set(-15.2, 4.4, 0);
  group.add(warehouse);

  const dockDoor = box(0.12, 4.7, 4.3, materials.concreteDark);
  dockDoor.position.set(-14.59, 2.75, 0);
  group.add(dockDoor);

  for (let row = 0; row < 5; row += 1) {
    const doorPanel = box(0.04, 0.035, 3.75, materials.steel);
    doorPanel.position.set(-14.5, 0.95 + row * 0.87, 0);
    group.add(doorPanel);
  }

  const platform = setShadow(box(2.4, 0.75, 5, materials.concrete));
  platform.position.set(-13.4, 0.3, 0);
  group.add(platform);

  for (const z of [-2.28, 2.28]) {
    const bumper = setShadow(box(0.38, 0.85, 0.34, materials.rubber));
    bumper.position.set(-12.12, 0.76, z);
    group.add(bumper);

    const dockLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), materials.buildingLight);
    dockLight.position.set(-14.45, 5.7, z * 1.2);
    group.add(dockLight);
  }

  const pod = new THREE.Group();
  pod.name = "ProofOfDeliveryClipboard";
  pod.position.set(-5.4, 3.25, 3.45);

  const board = setShadow(box(2.15, 2.85, 0.12, materials.timber));
  pod.add(board);
  const page = box(1.88, 2.58, 0.035, materials.paper);
  page.position.z = 0.08;
  pod.add(page);
  const clip = box(0.72, 0.22, 0.12, materials.brushedSteel);
  clip.position.set(0, 1.31, 0.16);
  pod.add(clip);

  const lineGeometry = new THREE.BoxGeometry(1.2, 0.025, 0.025);
  for (let index = 0; index < 5; index += 1) {
    const line = new THREE.Mesh(lineGeometry, materials.ink);
    line.position.set(-0.1, 0.73 - index * 0.32, 0.11);
    line.scale.x = index === 0 ? 0.62 : 1;
    pod.add(line);
  }

  const signatureCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.7, -0.8, 0.125),
    new THREE.Vector3(-0.4, -0.57, 0.13),
    new THREE.Vector3(-0.18, -0.91, 0.13),
    new THREE.Vector3(0.09, -0.53, 0.13),
    new THREE.Vector3(0.31, -0.82, 0.13),
    new THREE.Vector3(0.73, -0.64, 0.13),
  ]);
  const signatureGeometry = new THREE.TubeGeometry(signatureCurve, 32, 0.022, 5, false);
  const signature = new THREE.Mesh(signatureGeometry, materials.ink);
  signature.name = "PodSignature";
  signature.visible = false;
  pod.add(signature);

  const checkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.4, -1.1, 0.13),
    new THREE.Vector3(0.57, -1.28, 0.13),
    new THREE.Vector3(0.94, -0.92, 0.13),
  ]);
  const checkGeometry = new THREE.TubeGeometry(checkCurve, 14, 0.035, 5, false);
  const check = new THREE.Mesh(checkGeometry, materials.orangeGlow);
  check.name = "PodCheck";
  check.visible = false;
  pod.add(check);

  // The readable signature/check overlay is owned by Anime.js in the DOM.
  // These meshes remain as named extension points without competing for scroll state.
  function setDocumentProgress() {}

  setDocumentProgress(0);
  group.add(pod);

  return { group, warehouse, dockDoor, platform, pod, signature, check, setDocumentProgress };
}

export function disposeObject(root, materialSet = new Set(), geometrySet = new Set()) {
  root.traverse((object) => {
    if (object.geometry && !geometrySet.has(object.geometry)) {
      object.geometry.dispose();
      geometrySet.add(object.geometry);
    }
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => {
      if (materialSet.has(material)) return;
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose();
      });
      material.dispose();
      materialSet.add(material);
    });
  });
}
