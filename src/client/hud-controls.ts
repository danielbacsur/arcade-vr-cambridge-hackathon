import type { Pose } from '../shared/protocol.js';
import { normalize, rotate } from './tracking.js';
/** Constant view-relative HUD pose, including pitch and roll. */
export function hudAnchor(head: Pose): Pose {
  const orientation = normalize(head.orientation), offset = rotate(orientation, { x: 0, y: -.1, z: -2 });
  return { position: { x: head.position.x + offset.x, y: head.position.y + offset.y, z: head.position.z + offset.z }, orientation };
}
export const HUD_STICK = { x: 180, y: 860, radius: 110 };
export class HUDJoystick {
  private owner?: number;
  move = { x: 0, z: 0 };
  pointer(id: number, phase: 'down' | 'move' | 'up', x: number, y: number): boolean {
    if (phase === 'down' && this.owner === undefined && Math.hypot(x - HUD_STICK.x, y - HUD_STICK.y) <= HUD_STICK.radius * 1.3) this.owner = id;
    if (this.owner !== id) return false;
    if (phase === 'up') { this.release(); return true; }
    const dx = (x - HUD_STICK.x) / HUD_STICK.radius, dz = (y - HUD_STICK.y) / HUD_STICK.radius, length = Math.hypot(dx, dz), strength = Math.max(0, Math.min(1, (length - .12) / .88));
    this.move = length ? { x: dx / length * strength, z: dz / length * strength } : { x: 0, z: 0 }; return true;
  }
  owns(id: number): boolean { return this.owner === id; }
  release(): void { this.owner = undefined; this.move = { x: 0, z: 0 }; }
}
