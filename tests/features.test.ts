import { describe, expect, it, vi } from 'vitest';
import { activeFeatures, dispatchFeatures, registerFeature, type FeatureContext } from '../src/client/features.js';
import type { XRPacket } from '../src/shared/protocol.js';
describe('isolated optional features', () => {
  it('ships no active add-ons in main and deduplicates registration', () => { expect(activeFeatures()).toHaveLength(0); registerFeature({ name: 'fixture' }); registerFeature({ name: 'fixture' }); expect(activeFeatures()).toHaveLength(1); });
  it('contains a broken add-on, continues the frame and still cleans it up', () => {
    const reportError = vi.fn(), context = { engine: { reportError } } as unknown as FeatureContext, packet = {} as XRPacket, bad = vi.fn(() => { throw Error('fixture failure'); }), good = vi.fn(), cleanup = vi.fn();
    registerFeature({ name: 'bad', render: bad, end: cleanup }); registerFeature({ name: 'good', render: good }); dispatchFeatures({ type: 'start', context }); dispatchFeatures({ type: 'render', context, packet }); dispatchFeatures({ type: 'render', context, packet });
    expect(bad).toHaveBeenCalledTimes(1); expect(good).toHaveBeenCalledTimes(2); expect(reportError).toHaveBeenCalledTimes(1); dispatchFeatures({ type: 'end', context }); expect(cleanup).toHaveBeenCalledTimes(1);
    dispatchFeatures({ type: 'start', context }); dispatchFeatures({ type: 'render', context, packet }); expect(bad).toHaveBeenCalledTimes(2);
  });
});
