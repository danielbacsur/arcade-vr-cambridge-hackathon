import type { HandPose, Pose, Vector3 } from '../shared/protocol.js';
import { rotate } from './tracking.js';
/** Deliberate open-then-pinch activation; resting hands never start movement. */
export class HandJoystick {
  private anchor?: Vector3;
  private openedAt?: number;
  private armed = false;
  private armedUntil = 0;
  private pinchedAt?: number;
  private heading = 0;
  private lastTime?: number;
  private filtered = { x: 0, z: 0 };
  update(hand: HandPose | undefined, head: Pose, time?: number): { x: number; z: number } {
    const wrist = hand?.joints?.wrist?.position, thumb = hand?.joints?.['thumb-tip']?.position, index = hand?.joints?.['index-finger-tip']?.position;
    if (hand?.side !== 'left' || !wrist || !thumb || !index || ![wrist, thumb, index, head.position].every(p => [p.x, p.y, p.z].every(Number.isFinite))) return this.release();
    const now = time ?? performance.now();
    const distance = Math.hypot(thumb.x - index.x, thumb.y - index.y, thumb.z - index.z);
    const offset = { x: wrist.x - head.position.x, y: wrist.y - head.position.y, z: wrist.z - head.position.z };
    const forward = rotate(head.orientation, { x: 0, y: 0, z: -1 });
    const ahead = offset.x * forward.x + offset.z * forward.z;
    // A resting or newly tracked pinched hand must never start locomotion.
    if (offset.y < -.65 || offset.y > .15 || ahead < .15 || ahead > .8 || Math.hypot(offset.x, offset.z) > .85) return this.release();
    if (!this.anchor) {
      if (distance > .06) {
        this.openedAt ??= now;
        if (now - this.openedAt >= 250) { this.armed = true; this.armedUntil = now + 1500; }
        this.pinchedAt = undefined;
        return { x: 0, z: 0 };
      }
      this.openedAt = undefined;
      if (now > this.armedUntil) return this.release();
      if (!this.armed || distance > .02) { this.pinchedAt = undefined; return { x: 0, z: 0 }; }
      this.pinchedAt ??= now;
      if (now - this.pinchedAt < 180) return { x: 0, z: 0 };
    } else if (distance > .045 || Math.hypot(offset.x - this.anchor.x, offset.z - this.anchor.z) > .28) return this.release();
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
  release(): { x: number; z: number } { this.anchor = undefined; this.armed = false; this.openedAt = this.pinchedAt = undefined; this.lastTime = undefined; this.filtered = { x: 0, z: 0 }; return { x: 0, z: 0 }; }
}
