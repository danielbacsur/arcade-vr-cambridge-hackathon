import type { Pose } from '../shared/protocol.js';
import { rotate } from './tracking.js';
import { subtract } from './ik.js';
/** Intersect a WebXR ray with a panel, retaining the original page's coordinate space. */
export function panelHit(ray: Pose, panel: Pose, width: number, height: number): { u: number; v: number; distance: number } | null {
  const q = panel.orientation, inverse = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  const origin = rotate(inverse, subtract(ray.position, panel.position)), direction = rotate(inverse, rotate(ray.orientation, { x: 0, y: 0, z: -1 }));
  if (direction.z >= -1e-6 || width <= 0 || height <= 0) return null;
  const distance = -origin.z / direction.z; if (distance < 0 || !Number.isFinite(distance)) return null;
  const u = (origin.x + direction.x * distance) / width + .5, v = .5 - (origin.y + direction.y * distance) / height;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { u, v, distance } : null;
}
