import type * as PC from 'playcanvas';
import type { XRPacket, Quaternion, Pose } from '../shared/protocol.js';
import type { TrackingSpace } from './tracking.js';
import { multiply } from './tracking.js';
import { fromTo, subtract, twoBone } from './ik.js';
interface Arm { upper: PC.GraphNode; lower: PC.GraphNode; wrist: PC.GraphNode; upperLength: number; lowerLength: number; orientationOffset?: Quaternion }
const v = (node: PC.GraphNode) => { const p = node.getPosition(); return { x: p.x, y: p.y, z: p.z }; };
export class RigHands {
  private readonly arms = new Map<'left' | 'right', Arm>();
  private readonly bones = new Map<string, PC.GraphNode>();
  constructor(nodes: PC.GraphNode[]) {
    for (const node of nodes) this.bones.set(node.name.replace(/^mixamorig:?/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase(), node);
    for (const side of ['left', 'right'] as const) {
      const upper = this.bones.get(side + 'arm'), lower = this.bones.get(side + 'forearm'), wrist = this.bones.get(side + 'hand');
      if (upper && lower && wrist) { const distance = (a: PC.GraphNode, b: PC.GraphNode) => Math.hypot(...Object.values(subtract(v(a), v(b)))); this.arms.set(side, { upper, lower, wrist, upperLength: distance(upper, lower), lowerLength: distance(lower, wrist) }); }
    }
  }
  apply(packet: XRPacket, space: TrackingSpace, root: PC.Entity, save: (bone: PC.GraphNode) => void): number {
    const pc = window.pc; if (!pc) return 0; let tracked = 0;
    const rotate = (node: PC.GraphNode, rotation: Quaternion) => { save(node); node.setRotation(new pc.Quat(rotation.x, rotation.y, rotation.z, rotation.w)); };
    const aim = (node: PC.GraphNode, child: PC.GraphNode, target: PC.Vec3 | { x: number; y: number; z: number }) => rotate(node, multiply(fromTo(subtract(v(child), v(node)), subtract(target, v(node))), node.getRotation()));
    const toWorld = (pose: Pose) => space.world(pose, v(root));
    for (const hand of packet.hands) {
      const arm = this.arms.get(hand.side), source = hand.joints?.wrist || hand.grip; if (!arm || !source) continue;
      const world = toWorld(source), shoulder = v(arm.upper), pole = new pc.Quat().setFromEulerAngles(0, Math.atan2(root.forward.x, root.forward.z) * 180 / Math.PI, 0).transformVector(new pc.Vec3(hand.side === 'left' ? -.5 : .5, -.7, .2));
      const solved = twoBone(shoulder, world.position, pole, arm.upperLength, arm.lowerLength); if (!solved) continue;
      if (!arm.orientationOffset) arm.orientationOffset = multiply({ x: -world.orientation.x, y: -world.orientation.y, z: -world.orientation.z, w: world.orientation.w }, arm.wrist.getRotation());
      aim(arm.upper, arm.lower, solved.elbow); aim(arm.lower, arm.wrist, solved.hand); rotate(arm.wrist, multiply(world.orientation, arm.orientationOffset)); tracked++;
      const fingers = { thumb: 'thumb', index: 'index-finger', middle: 'middle-finger', ring: 'ring-finger', pinky: 'pinky-finger' } as const;
      for (const [name, prefix] of Object.entries(fingers)) for (let index = 1; index <= 3; index++) {
        const bone = this.bones.get(hand.side + 'hand' + name + index), child = bone?.children[0]; if (!bone || !child || !hand.joints) continue;
        const segment = name === 'thumb' ? ['metacarpal', 'phalanx-proximal', 'phalanx-distal', 'tip'] : ['phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];
        const first = hand.joints[`${prefix}-${segment[index - 1]}` as XRHandJoint], second = hand.joints[`${prefix}-${segment[index]}` as XRHandJoint]; if (!first || !second) continue;
        const direction = subtract(toWorld(second).position, toWorld(first).position), target = { x: v(bone).x + direction.x, y: v(bone).y + direction.y, z: v(bone).z + direction.z }; aim(bone, child, target);
      }
    }
    return tracked;
  }
}
