import { describe, expect, it } from 'vitest';
import { handLines } from '../src/client/hand-lines.js';
const pose = (x: number) => ({ position: { x, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } });
describe('optional visible hand proxies', () => {
  it('connects available joints without emitting invalid vertices', () => { const points = handLines({ side: 'left', pinch: 0, trigger: 0, joints: { wrist: pose(0), 'index-finger-phalanx-proximal': pose(1), 'index-finger-tip': pose(2), 'thumb-tip': pose(NaN) } }); expect(points.map(point => point.x)).toEqual([0, 1, 1, 2]); });
  it('supports controller-only input without invented finger poses', () => { expect(handLines({ side: 'right', pinch: 0, trigger: 1, grip: pose(0) })).toEqual([]); });
});
