import { expect, test } from 'vitest';
import { FrameWatchdog } from '../src/client/frame-watchdog.js';
test('render stall ends after a bounded delay, successful capture resets it', () => { const watch = new FrameWatchdog(); watch.reset(1); expect(watch.stalled(5000, true)).toBe(false); expect(watch.stalled(6002, true)).toBe(true); watch.reset(6002); expect(watch.stalled(8000, true)).toBe(false); });
test('headset suspension does not count as a capture stall', () => { const watch = new FrameWatchdog(); watch.reset(1); expect(watch.stalled(20000, false)).toBe(false); expect(watch.stalled(20001, true)).toBe(false); expect(watch.stalled(27000, true)).toBe(true); });
