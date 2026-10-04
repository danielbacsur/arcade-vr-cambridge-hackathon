import './globals.js';
import { XRPresenter } from './xr-presenter.js';
import { EngineController } from './engine.js';
import { CHANNEL, finite, isRecord, type RenderSettings, type RequestMessage } from '../shared/protocol.js';
const boot = window.ARCADE_PROXY;
if (!boot) throw Error('The Arcade proxy runtime configuration is missing.');
const session = crypto.randomUUID(), engine = new EngineController();
window.arcadeVR = engine;
new XRPresenter(engine);
let owner: { source: Window; origin: string } | undefined;
function send(data: Record<string, unknown>, transfer: Transferable[] = []): void { owner?.source.postMessage({ channel: CHANNEL, direction: 'stream', session, ...data }, owner.origin, transfer); }
engine.onState = state => send({ type: 'state', state });
engine.onFrame = (bitmap, id) => { if (owner) send({ type: 'bitmap', bitmap, width: bitmap.width, height: bitmap.height, id }, [bitmap]); else bitmap.close(); };
function settings(value: unknown): RenderSettings { const v = isRecord(value) ? value : {}; return { debug: v.debug !== false, width: Math.max(320, Math.min(v.debug === false ? 1920 : 1280, finite(v.width, 960))), height: Math.max(180, Math.min(v.debug === false ? 1080 : 720, finite(v.height, 540))), fps: Math.max(12, Math.min(90, finite(v.fps, 30))), tone: v.tone === 'aces' ? 'aces' : 'neutral', exposure: Math.max(.1, Math.min(2, finite(v.exposure, 1))) }; }
async function execute(request: RequestMessage): Promise<unknown> {
  const payload = isRecord(request.payload) ? request.payload : {};
  switch (request.op) {
    case 'ping': return { session, ready: engine.ready() };
    case 'describe': case 'controls.status': return engine.status();
    case 'controls.connect': return engine.connect(settings(payload));
    case 'controls.stop': engine.stop(); return engine.status();
    case 'controls.frameAck': engine.acknowledge(finite(payload.id)); return null;
    case 'controls.input': engine.input({ x: finite(payload.x), z: finite(payload.z), keys: Array.isArray(payload.keys) ? payload.keys.filter((key): key is string => typeof key === 'string') : [] }); return null;
    case 'controls.look': { const current = engine.lookState, delta = isRecord(payload.delta) ? payload.delta : null; engine.look(delta ? current.yaw + finite(delta.yaw) : finite(payload.yaw, current.yaw), delta ? current.pitch + finite(delta.pitch) : finite(payload.pitch, current.pitch)); return payload.brief ? null : engine.status(); }
    case 'controls.body': engine.bodyVisible(payload.visible === true); return engine.status();
    default: throw Error('Unknown runtime operation: ' + request.op);
  }
}
window.addEventListener('message', event => {
  const data: unknown = event.data;
  if (event.source !== parent || event.origin !== boot.wrapper || !isRecord(data) || data.channel !== CHANNEL || data.direction !== 'request' || typeof data.id !== 'string' || data.id.length > 120 || typeof data.op !== 'string' || data.session && data.session !== session) return;
  if (data.op === 'controls.connect' || data.op === 'ping') owner = { source: parent, origin: event.origin };
  if (!owner) return;
  const request = data as unknown as RequestMessage;
  void execute(request).then(result => parent.postMessage({ channel: CHANNEL, direction: 'response', id: request.id, session, ok: true, result }, event.origin)).catch(error => parent.postMessage({ channel: CHANNEL, direction: 'response', id: request.id, session, ok: false, error: error instanceof Error ? error.message : String(error) }, event.origin));
});
window.addEventListener('pagehide', () => engine.stop());
const style = document.createElement('style'); style.textContent = 'html,body{margin:0;background:#000}.arcade-xr-active,.arcade-xr-active body,.arcade-xr-active #root{background:transparent!important}.arcade-xr-active canvas[data-arcade-vr-engine="true"]{visibility:hidden!important}'; document.head.append(style);
