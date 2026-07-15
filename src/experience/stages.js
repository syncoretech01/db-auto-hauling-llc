import * as THREE from "three";
import { clamp01, smoother } from "./procedural.js";

export const STAGE_CONFIG = Object.freeze([
  Object.freeze({ id: "hero", label: "Approach", start: 0, end: 0.15, focus: 0.075, chapterIndex: 0 }),
  Object.freeze({ id: "load", label: "Load", start: 0.15, end: 0.3, focus: 0.225, chapterIndex: 0 }),
  Object.freeze({ id: "secure", label: "Secure", start: 0.3, end: 0.45, focus: 0.375, chapterIndex: 1 }),
  Object.freeze({ id: "move", label: "Move", start: 0.45, end: 0.67, focus: 0.56, chapterIndex: 2 }),
  Object.freeze({ id: "communicate", label: "Communicate", start: 0.67, end: 0.84, focus: 0.755, chapterIndex: 3 }),
  Object.freeze({ id: "deliver", label: "Deliver", start: 0.84, end: 1, focus: 0.92, chapterIndex: 4 }),
]);

const STAGE_ALIASES = Object.freeze({
  approach: "hero",
  loading: "load",
  secured: "secure",
  drive: "move",
  transit: "move",
  communication: "communicate",
  route: "communicate",
  delivery: "deliver",
  pod: "deliver",
  paperwork: "deliver",
  signed: "deliver",
});

const _nextPosition = new THREE.Vector3();
const _nextTarget = new THREE.Vector3();

const DESKTOP_POSES = [
  { at: 0, position: [10.5, 3.25, 9.6], target: [0.4, 1.45, 0] },
  { at: 0.15, position: [5.7, 5.1, 11.2], target: [-3.2, 1.7, 0] },
  { at: 0.3, position: [-1.2, 5.15, 8.15], target: [-5.8, 2.05, 0] },
  { at: 0.45, position: [-4.8, 3.2, 4.75], target: [-5.7, 2.12, 0] },
  { at: 0.58, position: [9.4, 3.05, 8.35], target: [-0.8, 1.3, 0] },
  { at: 0.67, position: [6.3, 5.2, 11.4], target: [-2.2, 1.2, 0] },
  { at: 0.84, position: [1.8, 13.2, 15.4], target: [-1.8, 0.75, 0] },
  { at: 0.96, position: [-7.9, 5.5, 9.3], target: [-8.7, 2, 0.25] },
  { at: 1, position: [-4.7, 3.85, 7.65], target: [-5.4, 2.85, 3.35] },
];

const MOBILE_POSES = [
  { at: 0, position: [8.3, 3.2, 10.2], target: [2.5, 1.45, 0] },
  { at: 0.15, position: [-2.1, 4.65, 9.6], target: [-4.9, 1.9, 0] },
  { at: 0.3, position: [-4.1, 4.25, 7.1], target: [-5.8, 2.15, 0] },
  { at: 0.45, position: [-5.05, 3.05, 5.75], target: [-5.75, 2.12, 0] },
  { at: 0.58, position: [7.8, 3.1, 9.4], target: [1.3, 1.3, 0] },
  { at: 0.67, position: [3.1, 6.3, 12.8], target: [-1.2, 1.05, 0] },
  { at: 0.84, position: [0.8, 15.4, 18.8], target: [-1.8, 0.5, 0] },
  { at: 0.96, position: [-8.9, 5.15, 9.8], target: [-9.8, 1.85, 0.2] },
  { at: 1, position: [-4.9, 3.75, 8.3], target: [-5.4, 2.85, 3.35] },
];

export function resolveStage(stage) {
  if (typeof stage === "number" && Number.isFinite(stage)) {
    return STAGE_CONFIG[Math.min(STAGE_CONFIG.length - 1, Math.max(0, Math.round(stage)))] ?? null;
  }
  if (typeof stage !== "string") return null;
  const normalized = stage.toLowerCase().trim();
  const id = STAGE_ALIASES[normalized] ?? normalized;
  return STAGE_CONFIG.find((item) => item.id === id) ?? null;
}

export function getStageAtProgress(progress) {
  const value = clamp01(progress);
  return STAGE_CONFIG.find((stage, index) => (
    value >= stage.start && (value < stage.end || index === STAGE_CONFIG.length - 1)
  )) ?? STAGE_CONFIG[0];
}

export function sampleCamera(progress, isMobile, positionTarget, lookTarget) {
  const value = clamp01(progress);
  const poses = isMobile ? MOBILE_POSES : DESKTOP_POSES;
  let from = poses[0];
  let to = poses[poses.length - 1];

  for (let index = 0; index < poses.length - 1; index += 1) {
    if (value >= poses[index].at && value <= poses[index + 1].at) {
      from = poses[index];
      to = poses[index + 1];
      break;
    }
  }

  const mix = smoother((value - from.at) / Math.max(0.00001, to.at - from.at));
  _nextPosition.set(...to.position);
  _nextTarget.set(...to.target);
  positionTarget.set(...from.position).lerp(_nextPosition, mix);
  lookTarget.set(...from.target).lerp(_nextTarget, mix);
  return { position: positionTarget, target: lookTarget };
}
