import type { HandPose, Pose, Vector3 } from '../shared/protocol.js';
import { rotate } from './tracking.js';
/** Left index pinch steers from a floating hand anchor; right pinch is reserved for UI. */
export class HandJoystick {
  private anchor?: Vector3;
  private heading = 0;
  private lastTime?: number;
  private filtered = { x: 0, z: 0 };
  update(hand: HandPose | undefined, head: Pose, time?: number): { x: number; z: number } {
    const wrist = hand?.joints?.wrist?.position, thumb = hand?.joints?.['thumb-tip']?.position, index = hand?.joints?.['index-finger-tip']?.position;
    if (hand?.side !== 'left' || !wrist || !thumb || !index || ![wrist, thumb, index, head.position].every(p => [p.x, p.y, p.z].every(Number.isFinite))) return this.release();
    const distance = Math.hypot(thumb.x - index.x, thumb.y - index.y, thumb.z - index.z);
    if (distance > (this.anchor ? .045 : .025)) return this.release();
    const offset = { x: wrist.x - head.position.x, y: wrist.y - head.position.y, z: wrist.z - head.position.z };
    if (!this.anchor) { this.anchor = offset; this.lastTime = time; const forward = rotate(head.orientation, { x: 0, y: 0, z: -1 }); this.heading = Math.atan2(-forward.x, -forward.z); }
    const dx = offset.x - this.anchor.x, dz = offset.z - this.anchor.z;
    const x = Math.cos(this.heading) * dx - Math.sin(this.heading) * dz, z = Math.sin(this.heading) * dx + Math.cos(this.heading) * dz;
    const length = Math.hypot(x, z), strength = Math.max(0, Math.min(1, (length - .02) / .08));
    const target = length ? { x: x / length * strength, z: z / length * strength } : { x: 0, z: 0 };
    const elapsed = time !== undefined && this.lastTime !== undefined ? Math.max(0, Math.min(80, time - this.lastTime)) : undefined;
    const blend = elapsed === undefined ? 1 : 1 - Math.exp(-elapsed / 50); this.lastTime = time;
    this.filtered = strength ? { x: this.filtered.x + (target.x - this.filtered.x) * blend, z: this.filtered.z + (target.z - this.filtered.z) * blend } : { x: 0, z: 0 };
    return { ...this.filtered };
  }
  release(): { x: number; z: number } { this.anchor = undefined; this.lastTime = undefined; this.filtered = { x: 0, z: 0 }; return { x: 0, z: 0 }; }
}
