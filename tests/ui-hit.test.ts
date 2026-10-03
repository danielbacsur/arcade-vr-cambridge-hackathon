import { describe, expect, it } from 'vitest';
import { panelHit } from '../src/client/ui-hit.js';
const orientation = { x: 0, y: 0, z: 0, w: 1 }, panel = { position: { x: 0, y: 1.5, z: -2 }, orientation };
describe('world UI interaction', () => {
  it('maps the center and page corners without changing aspect', () => { expect(panelHit({ position: { x: 0, y: 1.5, z: 0 }, orientation }, panel, 2, 1)).toEqual({ u: .5, v: .5, distance: 2 }); expect(panelHit({ position: { x: -.9, y: 1.95, z: 0 }, orientation }, panel, 2, 1)?.u).toBeCloseTo(.05); expect(panelHit({ position: { x: -.9, y: 1.95, z: 0 }, orientation }, panel, 2, 1)?.v).toBeCloseTo(.05); });
  it('rejects misses, reversed rays and invalid dimensions', () => { expect(panelHit({ position: { x: 3, y: 1.5, z: 0 }, orientation }, panel, 2, 1)).toBeNull(); expect(panelHit({ position: { x: 0, y: 1.5, z: -3 }, orientation }, panel, 2, 1)).toBeNull(); expect(panelHit({ position: { x: 0, y: 1.5, z: 0 }, orientation }, panel, 0, 1)).toBeNull(); });
});
