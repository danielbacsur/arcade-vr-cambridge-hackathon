import { registerFeature } from '../client/features.js';
import { QualityBudget } from '../client/quality-budget.js';
let budget = new QualityBudget();
registerFeature({ name: 'adaptive resolution', start() { budget = new QualityBudget(); }, frame(context, packet) { context.setRenderScale(budget.sample(context.engine.status().captureMs, packet.time)); } });
