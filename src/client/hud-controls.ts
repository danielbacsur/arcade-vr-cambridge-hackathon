import type { Pose } from '../shared/protocol.js';
import { normalize, rotate } from './tracking.js';
/** Constant view-relative HUD pose, including pitch and roll. */
export function hudAnchor(head: Pose): Pose {
  const orientation = normalize(head.orientation), offset = rotate(orientation, { x: 0, y: -.1, z: -2 });
  return { position: { x: head.position.x + offset.x, y: head.position.y + offset.y, z: head.position.z + offset.z }, orientation };
}
