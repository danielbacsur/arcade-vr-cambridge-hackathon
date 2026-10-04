import { expect, test, vi } from 'vitest';
import '../src/features/comfort.js';
import '../src/features/haptics-actions.js';
import { dispatchFeatures, type FeatureContext } from '../src/client/features.js';
import type { XRPacket } from '../src/shared/protocol.js';
test('hand-emulated gamepads cannot snap-turn or trigger controller actions', () => {
  const turn = vi.fn(), sources = ['left', 'right'].map(handedness => ({ handedness, hand: {}, gamepad: { axes: [1,0,1,0], buttons: [{pressed:false},{pressed:true}] } }));
  const context = { engine: { turn, reportError: vi.fn() }, session: { inputSources: sources }, setVignette: vi.fn() } as unknown as FeatureContext;
  const packet = { keys: [], move: {x:0,z:0} } as unknown as XRPacket;
  dispatchFeatures({ type:'start', context }); dispatchFeatures({ type:'frame', context, packet, frame: {} as XRFrame }); expect(turn).toHaveBeenLastCalledWith(0); expect(packet.keys).toEqual([]);
  for (const source of sources) delete (source as {hand?:object}).hand;
  dispatchFeatures({ type:'frame', context, packet, frame: {} as XRFrame }); expect(turn).toHaveBeenLastCalledWith(-30); expect(packet.keys).toContain('KeyC');
});
