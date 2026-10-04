import type { HandPose, Pose, Vector3 } from '../shared/protocol.js';
import { rotate } from './tracking.js';
/** Left thumb/middle pinch holds a floating stick; index pinch stays available for UI. */
export class HandJoystick {
  private anchor?: Vector3;
  private heading = 0;
  update(hand: HandPose | undefined, head: Pose): { x: number; z: number } {
    if (hand?.pinch) return this.release();
    const wrist = hand?.joints?.wrist?.position, thumb = hand?.joints?.['thumb-tip']?.position, middle = hand?.joints?.['middle-finger-tip']?.position;
    if (!wrist || !thumb || !middle || ![wrist, thumb, middle, head.position].every(p => [p.x, p.y, p.z].every(Number.isFinite))) return this.release();
    const distance = Math.hypot(thumb.x - middle.x, thumb.y - middle.y, thumb.z - middle.z);
    if (distance > (this.anchor ? .045 : .025)) return this.release();
    const offset = { x: wrist.x - head.position.x, y: wrist.y - head.position.y, z: wrist.z - head.position.z };
    if (!this.anchor) { this.anchor = offset; const forward = rotate(head.orientation, { x: 0, y: 0, z: -1 }); this.heading = Math.atan2(-forward.x, -forward.z); }
    const dx = offset.x - this.anchor.x, dz = offset.z - this.anchor.z;
    const x = Math.cos(this.heading) * dx - Math.sin(this.heading) * dz, z = Math.sin(this.heading) * dx + Math.cos(this.heading) * dz;
    const length = Math.hypot(x, z), strength = Math.max(0, Math.min(1, (length - .02) / .08));
    return length ? { x: x / length * strength, z: z / length * strength } : { x: 0, z: 0 };
  }
  release(): { x: number; z: number } { this.anchor = undefined; return { x: 0, z: 0 }; }
}
