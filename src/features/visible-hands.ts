import type * as PC from 'playcanvas';
import { registerFeature } from '../client/features.js';
import { app } from '../client/engine.js';
import { handLines } from '../client/hand-lines.js';
interface Visual { palm: PC.Entity; fingers: PC.Entity; mesh: PC.Mesh; material: PC.StandardMaterial }
const visuals = new Map<'left' | 'right', Visual>();
registerFeature({
  name: 'visible tracked hands',
  render(context, packet) {
    const pc = window.pc, application = app(); if (!pc || !application) return;
    for (const side of ['left', 'right'] as const) {
      const hand = packet.hands.find(value => value.side === side), grip = hand?.joints?.wrist || hand?.grip;
      let visual = visuals.get(side);
      if (!hand || !grip) { if (visual) { visual.palm.enabled = false; visual.fingers.enabled = false; } continue; }
      const world = context.engine.worldPose(grip); if (!world) continue;
      if (!visual) {
        const material = new pc.StandardMaterial(); material.useLighting = false; material.emissive = side === 'left' ? new pc.Color(.45, .8, 1) : new pc.Color(1, .75, .4); material.update();
        const palm = new pc.Entity('ArcadeVRHandProxy-' + side); application.root.addChild(palm); palm.addComponent('render', { type: 'box', castShadows: false, receiveShadows: false }); for (const instance of palm.render?.meshInstances || []) instance.material = material;
        const mesh = new pc.Mesh(application.graphicsDevice), fingers = new pc.Entity('ArcadeVRFingerProxy-' + side); application.root.addChild(fingers); fingers.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: false, receiveShadows: false }); visual = { palm, fingers, mesh, material }; visuals.set(side, visual);
      }
      const meter = context.engine.worldPose({ ...grip, position: { ...grip.position, y: grip.position.y + 1 } }); const units = meter ? Math.hypot(meter.position.x - world.position.x, meter.position.y - world.position.y, meter.position.z - world.position.z) : 1;
      visual.palm.enabled = true; visual.palm.setPosition(world.position.x, world.position.y, world.position.z); visual.palm.setRotation(new pc.Quat(world.orientation.x, world.orientation.y, world.orientation.z, world.orientation.w)); visual.palm.setLocalScale(.065 * units, .025 * units, .09 * units);
      const points = handLines(hand).flatMap(point => { const mapped = context.engine.worldPose({ position: point, orientation: grip.orientation }); return mapped ? [mapped.position.x, mapped.position.y, mapped.position.z] : []; });
      visual.fingers.enabled = points.length > 0; if (points.length) { visual.mesh.setPositions(points); visual.mesh.update(pc.PRIMITIVE_LINES); }
    }
  },
  end() { for (const visual of visuals.values()) { visual.palm.destroy(); visual.fingers.destroy(); visual.mesh.destroy(); visual.material.destroy(); } visuals.clear(); },
});
