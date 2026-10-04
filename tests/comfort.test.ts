import { describe, expect, it } from 'vitest';
import { comfortVignette, SnapTurn } from '../src/client/comfort.js';
describe('optional comfort controls', () => {
  it('turns once, waits for center and supports either direction', () => { const turn = new SnapTurn(); expect(turn.update(1)).toBe(-30); for (let i = 0; i < 100; i++) expect(turn.update(1)).toBe(0); expect(turn.update(.2)).toBe(0); expect(turn.update(-1)).toBe(30); expect(turn.update(NaN)).toBe(0); });
  it('keeps stationary vision unobstructed and bounds movement masking', () => { expect(comfortVignette(0)).toBe(0); expect(comfortVignette(1)).toBe(.55); expect(comfortVignette(100)).toBe(.55); });
});
