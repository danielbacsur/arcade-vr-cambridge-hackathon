import { describe, expect, it } from 'vitest';
import { gamepadInput } from '../src/client/gamepad.js';
describe('external gamepad mapping', () => {
  it('filters noisy axes, bounds diagonals and releases disconnected controls', () => {
    const pad = gamepadInput({ axes: [.1, 0, NaN, .14], buttons: [] }); expect(pad).toEqual({ x: 0, z: 0, yaw: 0, pitch: 0, keys: [] });
    const diagonal = gamepadInput({ axes: [1, -1, 1, 0], buttons: [{ pressed: true }] as GamepadButton[] }); expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1); expect(diagonal.keys).toEqual(['Space']); expect(gamepadInput(null).keys).toEqual([]);
  });
});
