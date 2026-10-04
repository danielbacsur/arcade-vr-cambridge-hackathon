import { expect, test } from 'vitest';
import { hudAnchor } from '../src/client/hud-controls.js';
import { rotate } from '../src/client/tracking.js';
test('HUD follows translated, pitched and rolled heads at a constant local offset', () => { for (const orientation of [{ x: 0, y: 0, z: 0, w: 1 }, { x: .3, y: .4, z: .2, w: .8 }]) { const head = { position: { x: 4, y: 1.7, z: -6 }, orientation }, panel = hudAnchor(head), q = panel.orientation; const local = rotate({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, { x: panel.position.x - head.position.x, y: panel.position.y - head.position.y, z: panel.position.z - head.position.z }); expect(local.x).toBeCloseTo(0); expect(local.y).toBeCloseTo(-.1); expect(local.z).toBeCloseTo(-2); } });
