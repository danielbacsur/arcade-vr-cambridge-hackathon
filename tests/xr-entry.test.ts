import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutomaticEntry } from '../src/client/xr-entry.js';
afterEach(() => vi.unstubAllGlobals());
describe('automatic immersive entry', () => {
  it('requests within a game gesture without an intermediate async step', async () => { const request = vi.fn(async () => {}), entry = new AutomaticEntry({ supported: () => true, ready: () => true, active: () => false, request, report: vi.fn() }); entry.tryEnter(true); expect(request).toHaveBeenCalledTimes(1); entry.tryEnter(true); expect(request).toHaveBeenCalledTimes(1); await Promise.resolve(); });
  it('waits for activation and never spams consent', () => { vi.stubGlobal('navigator', { userActivation: { isActive: false } }); const request = vi.fn(async () => {}), entry = new AutomaticEntry({ supported: () => true, ready: () => true, active: () => false, request, report: vi.fn() }); entry.tryEnter(false); expect(request).not.toHaveBeenCalled(); });
  it('respects refusal', async () => { const request = vi.fn(async () => { const error = Error('Declined'); error.name = 'NotAllowedError'; throw error; }), report = vi.fn(), entry = new AutomaticEntry({ supported: () => true, ready: () => true, active: () => false, request, report }); entry.tryEnter(true); await new Promise(resolve => setTimeout(resolve, 0)); entry.tryEnter(true); expect(request).toHaveBeenCalledTimes(1); expect(report).toHaveBeenCalledWith('Declined'); });
});
