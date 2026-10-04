import { registerFeature } from '../client/features.js';
import { SnapTurn, comfortVignette } from '../client/comfort.js';
let snap = new SnapTurn();
registerFeature({
  name: 'comfort controls',
  start() { snap = new SnapTurn(); },
  frame(context, packet) {
    const source = [...context.session.inputSources].find(input => input.handedness === 'right' && !input.hand), axes = source?.gamepad?.axes;
    context.engine.turn(snap.update(axes?.[2] || axes?.[0] || 0));
    context.setVignette(comfortVignette(Math.hypot(packet.move.x, packet.move.z)));
  },
});
