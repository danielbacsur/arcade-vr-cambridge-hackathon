import type { Pose, Quaternion, Vector3 } from '../shared/protocol.js';
export function normalize(q: Quaternion): Quaternion { const length = Math.hypot(q.x, q.y, q.z, q.w); return length > 1e-8 && Number.isFinite(length) ? { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length } : { x: 0, y: 0, z: 0, w: 1 }; }
export function multiply(a: Quaternion, b: Quaternion): Quaternion { return normalize({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z }); }
export function rotate(q: Quaternion, v: Vector3): Vector3 { q = normalize(q); const x = 2 * (q.y * v.z - q.z * v.y), y = 2 * (q.z * v.x - q.x * v.z), z = 2 * (q.x * v.y - q.y * v.x); return { x: v.x + q.w * x + q.y * z - q.z * y, y: v.y + q.w * y + q.z * x - q.x * z, z: v.z + q.w * z + q.x * y - q.y * x }; }
export function eyeDimensions(width: number, height: number, maxWidth = 2048, maxHeight = 2048): { width: number; height: number; scale: number } {
  const scale = Math.min(1, maxWidth / Math.max(1, width), maxHeight / Math.max(1, height)); return { width: Math.max(2, Math.floor(width * scale / 2) * 2), height: Math.max(2, Math.floor(height * scale / 2) * 2), scale };
}
/** Anchor to the game root and a calibrated eye height, never animated bones. */
export class TrackingSpace {
  private origin?: Vector3;
  private heading: Quaternion = { x: 0, y: 0, z: 0, w: 1 };
  scale = 1;
  constructor(public eyeHeight = 1.6) {}
  calibrate(center: Pose, yawDegrees: number): void {
    this.origin = { ...center.position }; this.scale = this.eyeHeight / Math.max(.8, Math.min(2.2, center.position.y || 1.6));
    const forward = rotate(center.orientation, { x: 0, y: 0, z: -1 });
    const initialYaw = Math.atan2(-forward.x, -forward.z) * 180 / Math.PI;
    const yaw = (yawDegrees - initialYaw) * Math.PI / 360; this.heading = { x: 0, y: Math.sin(yaw), z: 0, w: Math.cos(yaw) };
  }
  world(pose: Pose, root: Vector3): Pose {
    if (!this.origin) this.calibrate(pose, 0);
    const origin = this.origin || pose.position;
    const offset = rotate(this.heading, { x: (pose.position.x - origin.x) * this.scale, y: (pose.position.y - origin.y) * this.scale, z: (pose.position.z - origin.z) * this.scale });
    return { position: { x: root.x + offset.x, y: root.y + this.eyeHeight + offset.y, z: root.z + offset.z }, orientation: multiply(this.heading, pose.orientation) };
  }
  turn(degrees: number): void { const half = degrees * Math.PI / 360; this.heading = multiply({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }, this.heading); }
  reset(): void { this.origin = undefined; }
}
