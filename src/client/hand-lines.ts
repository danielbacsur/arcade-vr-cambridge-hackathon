import type { HandPose, Vector3 } from '../shared/protocol.js';
export function handLines(hand: HandPose): Vector3[] {
  const points: Vector3[] = [], joints = hand.joints; if (!joints) return points;
  for (const finger of ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger']) {
    const chain = finger === 'thumb' ? ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'] : ['wrist', ...['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'].map(segment => finger + '-' + segment)];
    let previous: Vector3 | undefined;
    for (const joint of chain) { const point = joints[joint as XRHandJoint]?.position; if (!point || !Object.values(point).every(Number.isFinite)) continue; if (previous) points.push(previous, point); previous = point; }
  }
  return points;
}
