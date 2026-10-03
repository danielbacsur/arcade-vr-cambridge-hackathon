import { describe, expect, it } from 'vitest';
import { fromTo, subtract, twoBone } from '../src/client/ik.js';
import { rotate } from '../src/client/tracking.js';
const origin = { x: 0, y: 0, z: 0 }, length = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
describe('avatar arm inverse kinematics', () => {
  it('preserves bone lengths over a volume of reachable hand positions', () => { for (const x of [-.4, 0, .4]) for (const y of [-.5, -.1, .2]) for (const z of [-.4, .2]) { const solution = twoBone(origin, { x, y, z }, { x: -1, y: -1, z: 0 }, .35, .3); if (!solution) throw Error(); expect(length(solution.elbow)).toBeCloseTo(.35, 5); expect(length(subtract(solution.hand, solution.elbow))).toBeCloseTo(.3, 5); } });
  it('clamps unreachable tracking and avoids NaN at the shoulder', () => { const far = twoBone(origin, { x: 10, y: 10, z: 10 }, origin, .3, .3); expect(far?.clamped).toBe(true); expect(far && length(far.hand)).toBeLessThan(.6); const zero = twoBone(origin, origin, origin, .3, .3); expect(zero && Object.values(zero.elbow).every(Number.isFinite)).toBe(true); expect(twoBone(origin, origin, origin, 0, .3)).toBeNull(); });
  it('handles opposite bone axes and nonfinite tracking', () => { const q = fromTo({ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }); expect(rotate(q, { x: 1, y: 0, z: 0 }).x).toBeCloseTo(-1); expect(twoBone(origin, { x: NaN, y: 0, z: 0 }, origin, .3, .3)).toBeNull(); });
});
