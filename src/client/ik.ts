import type { Quaternion, Vector3 } from '../shared/protocol.js';
import { normalize } from './tracking.js';
export const add = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const subtract = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vector3, value: number): Vector3 => ({ x: a.x * value, y: a.y * value, z: a.z * value });
export const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vector3, b: Vector3): Vector3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const length = (v: Vector3) => Math.hypot(v.x, v.y, v.z);
export function unit(v: Vector3): Vector3 { const size = length(v); return size > 1e-8 ? scale(v, 1 / size) : { x: 0, y: 0, z: 1 }; }
export function fromTo(from: Vector3, to: Vector3): Quaternion {
  const a = unit(from), b = unit(to), cosine = dot(a, b);
  if (cosine < -.999999) { const axis = unit(cross(a, Math.abs(a.x) < .8 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 })); return { ...axis, w: 0 }; }
  return normalize({ ...cross(a, b), w: 1 + cosine });
}
export function twoBone(shoulder: Vector3, target: Vector3, pole: Vector3, upper: number, lower: number): { elbow: Vector3; hand: Vector3; clamped: boolean } | null {
  if (![shoulder, target, pole].every(v => [v.x, v.y, v.z].every(Number.isFinite)) || !Number.isFinite(upper + lower) || upper < 1e-4 || lower < 1e-4) return null;
  const difference = subtract(target, shoulder), requested = length(difference), direction = unit(difference);
  const distance = Math.max(Math.abs(upper - lower) + 1e-5, Math.min(upper + lower - 1e-5, requested));
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance), height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const perpendicular = subtract(pole, scale(direction, dot(pole, direction)));
  const bend = length(perpendicular) > 1e-6 ? unit(perpendicular) : unit(cross(direction, Math.abs(direction.y) < .8 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }));
  return { elbow: add(shoulder, add(scale(direction, along), scale(bend, height))), hand: add(shoulder, scale(direction, distance)), clamped: Math.abs(requested - distance) > 1e-4 };
}
