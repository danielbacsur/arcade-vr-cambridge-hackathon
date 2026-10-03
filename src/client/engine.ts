import type * as PC from 'playcanvas';
import { finite, type RenderSettings, type RuntimeState, type Vector3 } from '../shared/protocol.js';
import type { EngineApplication, InputManager, InputSource } from './globals.js';
const vector = (v: PC.Vec3): Vector3 => ({ x: v.x, y: v.y, z: v.z });
export function app(): EngineApplication | undefined { return window.pcApp || window.gameManager?.getApp?.(); }
export function player(): PC.Entity | undefined { const gm = window.gameManager, plugin = gm?.getGameLogicPlugin?.(); return gm?.getPlayerControlService?.()?.controlledEntity || gm?.getLocalPlayerEntity?.() || plugin?.getLocalPlayerEntity?.() || plugin?.playerEntity; }
function camera(): PC.Entity | undefined { const found = window.gameManager?.getViewCamera?.(); return found && 'entity' in found ? found.entity : found; }
function inputManager(): InputManager | undefined { const gm = window.gameManager, service = gm?.getPlayerControlService?.(); for (const rig of [service?.getPlayRigController?.(), service?.getFpsController?.(), gm?.getFPSController?.(), gm?.playModeController?.fpsController]) { const input = rig?.getInputManager?.() || rig?.inputManager; if (input) return input; } return undefined; }
export function nodes(root: PC.Entity): PC.Entity[] { const output: PC.Entity[] = [], queue: PC.GraphNode[] = [root]; while (queue.length && output.length < 5000) { const node = queue.shift(); if (node) { if ('getGuid' in node) output.push(node as PC.Entity); queue.push(...node.children); } } return output; }
export class EngineController {
  private application?: EngineApplication;
  private headCamera?: PC.Entity;
  private target?: PC.RenderTarget;
  private texture?: PC.Texture;
  private captureCanvas?: OffscreenCanvas;
  private captureContext?: GPUCanvasContext;
  private manager?: InputManager;
  private source?: InputSource;
  private originalFrameEnd?: () => void;
  private originalSize?: { width: number; height: number; ratio: number; mode: string };
  private readonly savedCameras = new Map<PC.CameraComponent, boolean>();
  private readonly body = new Map<PC.MeshInstance, { visible: PC.MeshInstance['isVisibleFunc']; cull: boolean }>();
  private readonly boneRotations = new Map<PC.GraphNode, PC.Quat>();
  private head?: PC.GraphNode;
  private avatarYaw?: PC.GraphNode;
  private tracked?: PC.Entity;
  private headReference?: PC.Quat;
  private eyeHeight = 1.6;
  private originalExposure?: number;
  private settings: RenderSettings = { debug: true, width: 960, height: 540, fps: 30, tone: 'neutral', exposure: 1 };
  private keys = new Set<string>();
  private movement = { x: 0, z: 0 };
  private yaw = 0;
  private pitch = 0;
  private frames = 0;
  private frameTimes: number[] = [];
  private captureMs = 0;
  private lastCapture = 0;
  private lastInput = 0;
  private lastState = 0;
  private busy = false;
  private waitingAck = false;
  private frameId = 0;
  private error: string | null = null;
  private connected = false;
  private hiddenBody = true;
  onState: (state: RuntimeState) => void = () => {};
  onFrame: (bitmap: ImageBitmap, id: number) => void = bitmap => bitmap.close();
  ready(): boolean { const a = app(); return !!player() && !!a && (a.root.findComponents('render').length + a.root.findComponents('model').length) > 0; }
  status(): RuntimeState {
    const p = player(), now = performance.now(); this.frameTimes = this.frameTimes.filter(time => now - time < 2000);
    const count = this.frameTimes.length, elapsed = count > 1 ? now - (this.frameTimes[0] || now) : 0;
    return { connected: this.connected, ready: this.ready(), backend: this.application?.graphicsDevice.deviceType || '', player: p ? { name: p.name, position: vector(p.getPosition()) } : null, look: { yaw: this.yaw, pitch: this.pitch }, camera: this.headCamera ? vector(this.headCamera.getPosition()) : null, frames: this.frames, renderFPS: elapsed > 0 ? (count - 1) * 1000 / elapsed : 0, captureMs: this.captureMs, dimensions: { width: this.settings.width, height: this.settings.height }, xr: { active: false, supported: !!navigator.xr, mode: 'flat', ui: 'dom', hands: 0 }, error: this.error };
  }
  connect(settings: RenderSettings): RuntimeState {
    const a = app(), pc = window.pc, p = player(), input = inputManager();
    if (!a || !pc || !p || !input) throw Error('Waiting for the game and player controls.');
    this.stop(); this.settings = { ...settings }; this.application = a; this.manager = input; this.originalExposure = a.scene.exposure; a.scene.exposure = settings.exposure;
    const gd = a.graphicsDevice, main = camera()?.camera;
    if (!main) throw Error('Waiting for the game camera.');
    this.originalSize = { width: gd.width, height: gd.height, ratio: gd.maxPixelRatio, mode: a.resolutionMode };
    gd.maxPixelRatio = 1; a.setCanvasResolution(pc.RESOLUTION_FIXED, settings.width, settings.height);
    const cam = this.headCamera = new pc.Entity('ArcadeVRPlayerCamera'); a.root.addChild(cam);
    cam.addComponent('camera', { clearColor: main.clearColor, nearClip: .1, farClip: main.farClip || 1000, fov: 80, priority: 100, layers: [...main.layers].filter(layer => layer !== pc.LAYERID_UI), clearColorBuffer: true });
    if (!cam.camera) throw Error('Camera component could not be created.');
    for (const key of ['aperture', 'shutter', 'sensitivity'] as const) cam.camera[key] = main[key];
    cam.camera.toneMapping = settings.tone === 'aces' ? pc.TONEMAP_ACES : pc.TONEMAP_NEUTRAL; cam.camera.gammaCorrection = pc.GAMMA_SRGB;
    if (settings.debug) {
      if (!gd.wgpu) throw Error('Arcade requires WebGPU to capture the player camera.');
      this.texture = new pc.Texture(gd, { name: 'ArcadeVRPreview', width: settings.width, height: settings.height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false });
      this.target = new pc.RenderTarget({ colorBuffer: this.texture, depth: true, samples: 1 }); cam.camera.renderTarget = this.target;
      this.captureCanvas = new OffscreenCanvas(settings.width, settings.height); this.captureContext = this.captureCanvas.getContext('webgpu') || undefined;
      this.captureContext?.configure({ device: gd.wgpu, format: 'rgba8unorm', alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST });
    }
    const direction = p.getRotation().transformVector(new pc.Vec3(0, 0, 1)); this.yaw = Math.atan2(-direction.x, -direction.z) * 180 / Math.PI; this.pitch = 0;
    this.source = { id: 'arcade-vr-input', attach() {}, detach() {}, lastActivityAt: () => Date.now(), readMove: out => { const h = this.yaw * Math.PI / 180, mainYaw = this.cameraYaw() * Math.PI / 180, m = this.movement, length = Math.max(1, Math.hypot(m.x, m.z)); const x = Math.cos(h) * m.x + Math.sin(h) * m.z, z = -Math.sin(h) * m.x + Math.cos(h) * m.z; out.x = (Math.cos(mainYaw) * x - Math.sin(mainYaw) * z) / length; out.z = (Math.sin(mainYaw) * x + Math.cos(mainYaw) * z) / length; return Math.abs(m.x) + Math.abs(m.z) > .001; }, consumeLook: out => { out.x = out.y = 0; }, consumeWheel: () => 0, isJump: () => this.keys.has('Space'), isSprint: () => this.keys.has('ShiftLeft'), isCrouch: () => this.keys.has('KeyC'), isKeyPressed: () => false, isCodePressed: code => this.keys.has(code), readActions: (out, bindings) => { for (const [action, codes] of Object.entries(bindings)) if (codes.some(code => this.keys.has(code))) out[action] = 1; }, releaseAll: () => this.release() };
    input.addSource(this.source); this.connected = true; this.lastInput = performance.now(); this.frames = 0; this.frameTimes = []; this.error = null;
    a.on('prerender', this.beforeRender); a.on('postrender', this.afterRender);
    this.originalFrameEnd = gd.frameEnd; const original = this.originalFrameEnd; gd.frameEnd = () => { original.call(gd); void this.capture(); };
    this.beforeRender(); return this.status();
  }
  private cameraYaw(): number { const pc = window.pc, c = camera(); if (!pc || !c) return 0; const f = c.getRotation().transformVector(pc.Vec3.FORWARD); return Math.atan2(-f.x, -f.z) * 180 / Math.PI; }
  private beforeRender = (): void => {
    const p = player(), pc = window.pc, a = this.application, cam = this.headCamera?.camera;
    if (!this.connected || !p || !pc || !a || !cam) return;
    if (performance.now() - this.lastInput > 750) this.release(); this.afterRender();
    if (p !== this.tracked) { this.restoreBody(); this.tracked = p; this.headReference = undefined; const children = nodes(p); this.head = children.find(node => /^(mixamorig:)?head$/i.test(node.name)); this.avatarYaw = children.find(node => /_MoldYaw$/.test(node.name)); this.eyeHeight = Math.max(.4, Math.min(4, this.head ? this.head.getPosition().y - p.getPosition().y + .08 : 1.6)); }
    for (const entity of nodes(p)) for (const mesh of [...entity.render?.meshInstances || [], ...entity.model?.meshInstances || []]) if (!this.body.has(mesh)) {
      const saved = { visible: mesh.isVisibleFunc, cull: mesh.cull }; this.body.set(mesh, saved); mesh.cull = true;
      mesh.isVisibleFunc = (view: PC.Camera) => this.hiddenBody && view === cam.camera ? false : saved.visible ? saved.visible.call(mesh, view) : !saved.cull || view.frustum.containsAabb(mesh.aabb);
    }
    if (!this.settings.debug) { for (const candidate of a.root.findComponents('camera') as PC.CameraComponent[]) if (candidate !== cam) { if (!this.savedCameras.has(candidate)) this.savedCameras.set(candidate, candidate.enabled); candidate.enabled = false; } }
    else cam.enabled = !this.busy && !this.waitingAck && performance.now() - this.lastCapture >= 1000 / this.settings.fps - 2;
    const pose = new pc.Quat().setFromEulerAngles(this.pitch, this.yaw, 0), body = new pc.Quat().setFromEulerAngles(0, this.yaw + 180, 0); p.setRotation(body);
    if (this.avatarYaw) { this.boneRotations.set(this.avatarYaw, this.avatarYaw.getLocalRotation().clone()); this.avatarYaw.setRotation(body); }
    if (this.head) { this.boneRotations.set(this.head, this.head.getLocalRotation().clone()); this.headReference ||= body.clone().invert().mul(this.head.getRotation()); this.head.setRotation(pose.clone().mul(new pc.Quat().setFromEulerAngles(0, 180, 0)).mul(this.headReference)); }
    const position = p.getPosition();
    this.headCamera?.setPosition(position.x, position.y + this.eyeHeight, position.z); this.headCamera?.setRotation(pose);
  };
  private afterRender = (): void => { for (const [bone, rotation] of this.boneRotations) bone.setLocalRotation(rotation); this.boneRotations.clear(); };
  private async capture(): Promise<void> {
    const a = this.application, camera = this.headCamera; if (!a || !camera || !this.connected) return;
    const now = performance.now(); this.frameTimes.push(now);
    if (now - this.lastState > 200) { this.lastState = now; this.onState(this.status()); }
    if (!this.settings.debug || !camera.camera?.enabled || this.busy || this.waitingAck || now - this.lastCapture < 1000 / this.settings.fps - 2) return;
    this.busy = true; this.lastCapture = now;
    try {
      const gd = a.graphicsDevice, device = gd.wgpu, texture = this.texture as PC.Texture & { impl?: { gpuTexture?: GPUTexture } };
      if (!device || !texture?.impl?.gpuTexture || !this.captureContext || !this.captureCanvas) return;
      const encoder = device.createCommandEncoder(); encoder.copyTextureToTexture({ texture: texture.impl.gpuTexture }, { texture: this.captureContext.getCurrentTexture() }, { width: this.settings.width, height: this.settings.height }); device.queue.submit([encoder.finish()]);
      const bitmap = await createImageBitmap(this.captureCanvas); if (!this.connected || camera !== this.headCamera) { bitmap.close(); return; }
      this.frames++; this.waitingAck = true; this.onFrame(bitmap, ++this.frameId); this.captureMs = performance.now() - now;
    } catch (error) { this.error = error instanceof Error ? error.message : String(error); } finally { this.busy = false; }
  }
  acknowledge(id: number): void { if (id === this.frameId) this.waitingAck = false; }
  input(data: { x: number; z: number; keys: string[] }): void { this.movement = { x: Math.max(-1, Math.min(1, finite(data.x))), z: Math.max(-1, Math.min(1, finite(data.z))) }; this.lastInput = performance.now(); this.setKeys(new Set(data.keys.filter(key => /^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|KeyC)$/.test(key)))); }
  look(yaw: number, pitch: number): void { this.yaw = ((finite(yaw) + 180) % 360 + 360) % 360 - 180; this.pitch = Math.max(-85, Math.min(85, finite(pitch))); this.beforeRender(); }
  bodyVisible(visible: boolean): void { this.hiddenBody = !visible; }
  private setKeys(next: Set<string>): void { const emit = (code: string, down: boolean) => { const key = code === 'Space' ? ' ' : code === 'ShiftLeft' ? 'Shift' : code.replace(/^(Key|Digit)/, '').toLowerCase(), keyCode = code === 'Space' ? 32 : code === 'ShiftLeft' ? 16 : key.toUpperCase().charCodeAt(0); window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key, keyCode, which: keyCode, bubbles: true, cancelable: true })); }; for (const key of this.keys) if (!next.has(key)) emit(key, false); for (const key of next) if (!this.keys.has(key)) emit(key, true); this.keys = next; }
  release(): void { this.setKeys(new Set()); this.movement = { x: 0, z: 0 }; }
  private restoreBody(): void { for (const [mesh, saved] of this.body) { mesh.isVisibleFunc = saved.visible; mesh.cull = saved.cull; } this.body.clear(); }
  stop(): void {
    this.release(); this.afterRender(); this.restoreBody(); const a = this.application; this.connected = false;
    if (a) { if (this.originalExposure !== undefined) a.scene.exposure = this.originalExposure; a.off('prerender', this.beforeRender); a.off('postrender', this.afterRender); if (this.originalFrameEnd) a.graphicsDevice.frameEnd = this.originalFrameEnd; if (this.originalSize) { a.graphicsDevice.maxPixelRatio = this.originalSize.ratio; a.setCanvasResolution(this.originalSize.mode, this.originalSize.width / this.originalSize.ratio, this.originalSize.height / this.originalSize.ratio); } }
    for (const [cam, enabled] of this.savedCameras) if (cam.entity.parent) cam.enabled = enabled; this.savedCameras.clear();
    if (this.source) this.manager?.removeSource(this.source); this.source = undefined; this.manager = undefined;
    this.headCamera?.destroy(); this.target?.destroy(); this.texture?.destroy(); this.captureContext?.unconfigure();
    this.headCamera = this.target = this.texture = this.captureCanvas = this.captureContext = undefined;
    this.tracked = undefined; this.headReference = undefined; this.head = this.avatarYaw = undefined; this.busy = this.waitingAck = false;
  }
}
