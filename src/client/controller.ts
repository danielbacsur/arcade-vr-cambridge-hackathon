import { CHANNEL, finite, isRecord, type RuntimeState, type RenderSettings, type StreamMessage } from '../shared/protocol.js';
function element<T extends HTMLElement>(selector: string): T { const node = document.querySelector<T>(selector); if (!node) throw Error(`Missing player element: ${selector}`); return node; }
const frame = element<HTMLIFrameElement>('#arena'), view = element<HTMLCanvasElement>('#view'), context = view.getContext('2d', { alpha: false, colorSpace: 'srgb' });
const connection = element('#connection'), feed = element('#feed-state'), diagnostics = element('#diagnostics'), overlay = element('#loading-state');
let origin = '', session: string | undefined, connected = false, connecting = false, immersive = false, move = { x: 0, z: 0 }, look = { yaw: 0, pitch: 0 }, looking: { id: number; x: number; y: number } | null = null, latest: RuntimeState | undefined;
const held = new Set<string>(), pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
function request(op: string, payload?: unknown): Promise<unknown> { return new Promise((resolve, reject) => { const id = crypto.randomUUID(), timer = setTimeout(() => { pending.delete(id); reject(Error('The game has not responded yet.')); }, 8000); pending.set(id, { resolve, reject, timer }); frame.contentWindow?.postMessage({ channel: CHANNEL, direction: 'request', id, op, payload, session }, origin); }); }
function signal(op: string, payload?: unknown): void { frame.contentWindow?.postMessage({ channel: CHANNEL, direction: 'request', id: crypto.randomUUID(), op, payload, session }, origin); }
function sendInput(): void { if (connected) signal('controls.input', { ...move, keys: [...held] }); }
function release(): void { move = { x: 0, z: 0 }; held.clear(); element('#stick').style.transform = ''; sendInput(); }
function renderSettings(): RenderSettings { const dimensions: Record<string, [number, number]> = { low: [960, 540], balanced: [1280, 720], sharp: [1920, 1080] }, size = immersive ? dimensions.sharp : dimensions[element<HTMLSelectElement>('#quality').value]; return { debug: !immersive, width: size?.[0] || 960, height: size?.[1] || 540, fps: immersive ? 72 : 30, tone: element<HTMLSelectElement>('#tone').value === 'aces' ? 'aces' : 'neutral', exposure: Number(element<HTMLInputElement>('#exposure').value) }; }
function show(state: RuntimeState): void { latest = state; connected = state.connected; if (!looking) look = state.look; element<HTMLInputElement>('#yaw').value = String(look.yaw); element<HTMLInputElement>('#pitch').value = String(look.pitch); const p = state.player?.position; element('#telemetry').textContent = p ? `Player: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}\nLook: ${look.yaw.toFixed(1)}° yaw, ${look.pitch.toFixed(1)}° pitch` : 'Waiting for the player'; if (state.error) feed.textContent = state.error; }
window.addEventListener('message', event => {
  const data: unknown = event.data;
  if (event.source !== frame.contentWindow || event.origin !== origin || !isRecord(data) || data.channel !== CHANNEL) return;
  if (data.direction === 'response' && typeof data.id === 'string') { if (typeof data.session === 'string') session = data.session; const waiting = pending.get(data.id); if (waiting) { clearTimeout(waiting.timer); pending.delete(data.id); if (data.ok) waiting.resolve(data.result); else waiting.reject(Error(String(data.error))); } return; }
  if (data.direction !== 'stream' || data.session !== session) return;
  const stream = data as unknown as StreamMessage;
  if (stream.type === 'state' && stream.state) { show(stream.state); if (immersive) { overlay.hidden = stream.state.ready; overlay.textContent = stream.state.error || 'Loading the game…'; } return; }
  if (stream.type === 'bitmap' && stream.bitmap instanceof ImageBitmap) {
    try { if (stream.bitmap.width <= 1920 && stream.bitmap.height <= 1080) { context?.drawImage(stream.bitmap, 0, 0, view.width, view.height); view.dataset.frames = String(finite(Number(view.dataset.frames)) + 1); feed.textContent = `${stream.bitmap.width} × ${stream.bitmap.height} · ${Math.round(latest?.renderFPS || 0)} fps`; } } finally { stream.bitmap.close(); signal('controls.frameAck', { id: stream.id }); }
  }
});
async function connect(): Promise<void> {
  if (connecting || !origin) return; connecting = true;
  try { const result = await request('controls.connect', renderSettings()); if (!isRecord(result)) throw Error('The game returned an invalid state.'); show(result as unknown as RuntimeState); connection.textContent = 'Connected'; diagnostics.textContent = JSON.stringify(result, null, 2); sendInput(); }
  catch (error) { connected = false; connection.textContent = error instanceof Error ? error.message : String(error); }
  finally { connecting = false; }
}
element('#connect').onclick = () => { void connect(); };
element('#stop').onclick = () => { release(); };
element('#inspect').onclick = () => { void request('controls.status').then(state => { diagnostics.textContent = JSON.stringify(state, null, 2); }); };
const joystick = element('#joystick'); let pointer: number | null = null;
function drag(event: PointerEvent): void { const rect = joystick.getBoundingClientRect(), dx = event.clientX - rect.left - rect.width / 2, dz = event.clientY - rect.top - rect.height / 2, distance = Math.hypot(dx, dz), scale = Math.min(1, distance / 58); move = { x: distance ? dx / distance * scale : 0, z: distance ? dz / distance * scale : 0 }; element('#stick').style.transform = `translate(${move.x * 58}px,${move.z * 58}px)`; sendInput(); }
joystick.addEventListener('pointerdown', event => { if (connected) { pointer = event.pointerId; joystick.setPointerCapture(pointer); drag(event); } }); joystick.addEventListener('pointermove', event => { if (event.pointerId === pointer) drag(event); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(name, () => { pointer = null; release(); });
function hold(button: HTMLElement, down: () => void, up: () => void): void { button.addEventListener('pointerdown', event => { button.setPointerCapture(event.pointerId); down(); button.classList.add('held'); sendInput(); }); for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => { up(); button.classList.remove('held'); sendInput(); }); button.addEventListener('keydown', event => { if (!event.repeat && ['Space', 'Enter'].includes(event.code)) { event.preventDefault(); down(); sendInput(); } }); button.addEventListener('keyup', () => { up(); sendInput(); }); }
for (const button of document.querySelectorAll<HTMLElement>('[data-key]')) hold(button, () => held.add(button.dataset.key || ''), () => held.delete(button.dataset.key || ''));
for (const button of document.querySelectorAll<HTMLElement>('[data-move]')) { const [x, z] = (button.dataset.move || '').split(',').map(Number); hold(button, () => { move = { x: x || 0, z: z || 0 }; }, () => { move = { x: 0, z: 0 }; }); }
hold(element('#custom-action'), () => { const value = element<HTMLInputElement>('#custom-key').value.toUpperCase(); if (/^[A-Z]$/.test(value)) held.add('Key' + value); if (/^[0-9]$/.test(value)) held.add('Digit' + value); }, () => { for (const key of held) if (!['Space', 'ShiftLeft'].includes(key)) held.delete(key); });
view.addEventListener('pointerdown', event => { if (connected) { looking = { id: event.pointerId, x: event.clientX, y: event.clientY }; view.setPointerCapture(event.pointerId); } });
view.addEventListener('pointermove', event => { if (looking?.id !== event.pointerId) return; look = { yaw: look.yaw - (event.clientX - looking.x) * .22, pitch: Math.max(-85, Math.min(85, look.pitch - (event.clientY - looking.y) * .22)) }; looking.x = event.clientX; looking.y = event.clientY; signal('controls.look', { ...look, brief: true }); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) view.addEventListener(name, () => { looking = null; });
for (const id of ['yaw', 'pitch']) element<HTMLInputElement>('#' + id).oninput = event => { look[id as 'yaw' | 'pitch'] = Number((event.target as HTMLInputElement).value); signal('controls.look', { ...look, brief: true }); };
const keyboard = new Set<string>(); const updateKeys = () => { move = { x: Number(keyboard.has('KeyD') || keyboard.has('ArrowRight')) - Number(keyboard.has('KeyA') || keyboard.has('ArrowLeft')), z: Number(keyboard.has('KeyS') || keyboard.has('ArrowDown')) - Number(keyboard.has('KeyW') || keyboard.has('ArrowUp')) }; sendInput(); };
window.addEventListener('keydown', event => { if (event.ctrlKey || event.metaKey || event.altKey || !connected || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return; if (/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|Arrow(Up|Down|Left|Right))$/.test(event.code)) { event.preventDefault(); keyboard.add(event.code); held.add(event.code); updateKeys(); } });
window.addEventListener('keyup', event => { keyboard.delete(event.code); held.delete(event.code); updateKeys(); });
window.addEventListener('blur', () => { keyboard.clear(); release(); }); document.addEventListener('visibilitychange', () => { if (document.hidden) release(); }); window.addEventListener('pagehide', release);
for (const id of ['quality', 'tone', 'exposure']) element('#' + id).onchange = () => { if (connected) void connect(); };
frame.addEventListener('load', () => { session = undefined; connected = false; for (const waiting of pending.values()) { clearTimeout(waiting.timer); waiting.reject(Error('The game navigated.')); } pending.clear(); });
const viewport = element('.live-view'); new ResizeObserver(() => { frame.style.transform = immersive ? 'none' : `scale(${viewport.clientWidth / 1920})`; }).observe(viewport);
async function initialize(): Promise<void> { immersive = await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false) || false; document.body.dataset.mode = immersive ? 'vr' : 'debug'; overlay.hidden = !immersive; const url = new URL(location.href); url.hostname = location.hostname.replace(/^editor\./, 'runtime.'); if (location.hostname === 'editor.localhost') url.hostname = 'runtime.joinarcade.localhost'; url.searchParams.set('xr', immersive ? '1' : '0'); origin = url.origin; frame.src = url.href; }
setInterval(() => { if (!connected && !connecting && !document.hidden) void connect(); else if (connected) sendInput(); }, 500);
void initialize().catch(error => { connection.textContent = String(error); });
