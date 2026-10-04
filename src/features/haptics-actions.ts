import { registerFeature } from '../client/features.js';
import { Feedback, InteractionPulse, type HapticOutput } from '../client/feedback.js';
const feedback = new Feedback(), interaction = new InteractionPulse();
registerFeature({
  name: 'haptics and interaction',
  select(_context, source, handled) { const pad = source.gamepad as unknown as { hapticActuators?: HapticOutput[]; vibrationActuator?: HapticOutput } | undefined; feedback.pulse(pad?.hapticActuators?.[0] || pad?.vibrationActuator, performance.now()); if (source.handedness === 'right') interaction.select(handled, performance.now()); },
  frame(context, packet) { packet.keys.push(...interaction.keys(performance.now())); if ([...context.session.inputSources].some(source => source.handedness === 'left' && !source.hand && source.gamepad?.buttons[1]?.pressed)) packet.keys.push('KeyC'); },
  end() { interaction.clear(); },
});
