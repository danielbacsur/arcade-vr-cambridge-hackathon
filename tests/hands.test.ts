import * as pc from 'playcanvas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RigHands } from '../src/client/hands.js';
import { TrackingSpace } from '../src/client/tracking.js';
import type { XRPacket } from '../src/shared/protocol.js';
afterEach(() => vi.unstubAllGlobals());
describe('rig hand mapping', () => {
  it('moves a real graph hierarchy to a tracked wrist and restores its animation pose', () => {
    vi.stubGlobal('window', { pc }); const root = new pc.Entity('Player'), upper = new pc.GraphNode('mixamorig:LeftArm'), lower = new pc.GraphNode('mixamorig:LeftForeArm'), wrist = new pc.GraphNode('mixamorig:LeftHand'); root.addChild(upper); upper.addChild(lower); lower.addChild(wrist); upper.setLocalPosition(-.25, 1.4, 0); lower.setLocalPosition(-.3, 0, 0); wrist.setLocalPosition(-.25, 0, 0);
    const before = wrist.getPosition().clone(), space = new TrackingSpace(1.6), center = { position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } }; space.calibrate(center, 0);
    const packet: XRPacket = { center, views: [], move: { x: 0, z: 0 }, keys: [], frameId: 1, time: 0, hands: [{ side: 'left', grip: { position: { x: -.4, y: 1, z: -.2 }, orientation: center.orientation }, pinch: 0, trigger: 0 }] };
    const saved = new Map<pc.GraphNode, pc.Quat>(), rig = new RigHands([upper, lower, wrist]); expect(rig.apply(packet, space, root, bone => { if (!saved.has(bone)) saved.set(bone, bone.getLocalRotation().clone()); })).toBe(1);
    expect(wrist.getPosition().x).toBeCloseTo(-.4, 4); expect(wrist.getPosition().y).toBeCloseTo(1, 4); expect(wrist.getPosition().z).toBeCloseTo(-.2, 4); expect(root.getPosition().length()).toBe(0);
    for (const [bone, rotation] of saved) bone.setLocalRotation(rotation); expect(wrist.getPosition().distance(before)).toBeLessThan(.0001);
    expect(rig.apply({ ...packet, hands: [] }, space, root, () => {})).toBe(0);
  });
  it('tolerates a nonhumanoid game without altering its hierarchy', () => { vi.stubGlobal('window', { pc }); const root = new pc.Entity('vehicle'), rig = new RigHands([root]), center = { position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } }; expect(rig.apply({ center, views: [], move: { x: 0, z: 0 }, keys: [], frameId: 1, time: 0, hands: [] }, new TrackingSpace(), root, () => { throw Error(); })).toBe(0); });
});
