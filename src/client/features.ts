import type { XRPacket, EyePose } from '../shared/protocol.js';
import type { EngineController } from './engine.js';
import type { WorldUI } from './world-ui.js';
export interface FeatureContext { engine: EngineController; session: XRSession; space: XRReferenceSpace; gl: WebGL2RenderingContext; ui?: WorldUI; setRenderScale(scale: number): void; setVignette(amount: number): void }
export interface XRFeature { name: string; start?(context: FeatureContext): void; frame?(context: FeatureContext, packet: XRPacket, frame: XRFrame): void; render?(context: FeatureContext, packet: XRPacket): void; eye?(context: FeatureContext, eye: EyePose): void; select?(context: FeatureContext, source: XRInputSource, handled: boolean): void; end?(context: FeatureContext): void }
const features: XRFeature[] = [];
export function registerFeature(feature: XRFeature): void { if (!features.some(item => item.name === feature.name)) features.push(feature); }
export function activeFeatures(): readonly XRFeature[] { return features; }
export type FeatureEvent = { type: 'start' | 'end'; context: FeatureContext } | { type: 'frame'; context: FeatureContext; packet: XRPacket; frame: XRFrame } | { type: 'render'; context: FeatureContext; packet: XRPacket } | { type: 'eye'; context: FeatureContext; eye: EyePose } | { type: 'select'; context: FeatureContext; source: XRInputSource; handled: boolean };
const disabled = new Set<string>();
export function dispatchFeatures(event: FeatureEvent): void {
  if (event.type === 'start') disabled.clear();
  for (const feature of features) {
    if (disabled.has(feature.name) && event.type !== 'end') continue;
    try { switch (event.type) {
      case 'start': feature.start?.(event.context); break;
      case 'end': feature.end?.(event.context); break;
      case 'frame': feature.frame?.(event.context, event.packet, event.frame); break;
      case 'render': feature.render?.(event.context, event.packet); break;
      case 'eye': feature.eye?.(event.context, event.eye); break;
      case 'select': feature.select?.(event.context, event.source, event.handled); break;
    } } catch (error) { disabled.add(feature.name); event.context.engine.reportError(feature.name + ': ' + (error instanceof Error ? error.message : 'Feature unavailable')); }
  }
}
