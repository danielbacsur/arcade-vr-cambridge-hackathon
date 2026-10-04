import { afterEach, describe, expect, it, vi } from 'vitest';
import * as pc from 'playcanvas';
import { EngineController } from '../src/client/engine.js';
afterEach(() => vi.unstubAllGlobals());
describe('native game loading gate', () => {
  it('waits through rules initialization without modifying the renderer and ignores HUD health meters', () => {
    const addSource = vi.fn(), resize = vi.fn(), actor = new pc.Entity('player');
    vi.stubGlobal('window', { pc, pcApp: { root: { findComponents: () => [{}] }, setCanvasResolution: resize }, gameManager: { getPlayerControlService: () => ({ controlledEntity: actor, getPlayRigController: () => ({ getInputManager: () => ({ addSource }) }) }) } });
    let visible = true, heading = 'LOADING'; const bar = { getClientRects: () => visible ? [{}] : [], getAttribute: () => 'Starting rules engine', closest: () => ({ querySelector: () => ({ textContent: heading }) }) };
    vi.stubGlobal('document', { querySelectorAll: () => [bar] }); const engine = new EngineController();
    expect(engine.ready()).toBe(false); expect(() => engine.connect({ debug: true, width: 960, height: 540, fps: 30, tone: 'neutral', exposure: 1 })).toThrow('Waiting for the game'); expect(resize).not.toHaveBeenCalled(); expect(addSource).not.toHaveBeenCalled();
    visible = false; expect(engine.ready()).toBe(true); visible = true; heading = 'Health'; expect(engine.ready()).toBe(true);
  });
});
