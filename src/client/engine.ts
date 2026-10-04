import type * as PC from 'playcanvas';
import { finite, type RenderSettings, type RuntimeState, type Vector3, type XRPacket, type Pose } from '../shared/protocol.js';
import { RigHands } from './hands.js';
import { TrackingSpace, rotate } from './tracking.js';
import { PreviewUI } from './preview-ui.js';
import { capturePair } from './capture-pair.js';
import type { EngineApplication, InputManager, InputSource } from './globals.js';
const rotateForward = (q: import('../shared/protocol.js').Quaternion) => rotate(q, { x: 0, y: 0, z: -1 });
const vector = (v: PC.Vec3): Vector3 => ({ x: v.x, y: v.y, z: v.z });
export function app(): EngineApplication | undefined { return window.pcApp || window.gameManager?.getApp?.(); }
export function player(): PC.Entity | undefined { const gm = window.gameManager, plugin = gm?.getGameLogicPlugin?.(); return gm?.getPlayerControlService?.()?.controlledEntity || gm?.getLocalPlayerEntity?.() || plugin?.getLocalPlayerEntity?.() || plugin?.playerEntity; }
function camera(): PC.Entity | undefined { const found = window.gameManager?.getViewCamera?.(); return found && 'entity' in found ? found.entity : found; }
function inputManager(): InputManager | undefined { const gm = window.gameManager, service = gm?.getPlayerControlService?.(); for (const rig of [service?.getPlayRigController?.(), service?.getFpsController?.(), gm?.getFPSController?.(), gm?.playModeController?.fpsController]) { const input = rig?.getInputManager?.() || rig?.inputManager; if (input) return input; } return undefined; }
export function graphNodes(root: PC.GraphNode): PC.GraphNode[] { const output: PC.GraphNode[] = [], queue: PC.GraphNode[] = [root], seen = new Set<PC.GraphNode>(); while (queue.length && output.length < 5000) { const node = queue.shift(); if (node && !seen.has(node)) { seen.add(node); output.push(node); queue.push(...node.children); if ('model' in node) { const graph = (node as PC.Entity).model?.model?.graph; if (graph) queue.push(graph); } } } return output; }
export function nodes(root: PC.Entity): PC.Entity[] { return graphNodes(root).filter((node): node is PC.Entity => 'getGuid' in node); }
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
  private readonly savedShadows = new Map<PC.LightComponent, number>();
  private readonly savedCameras = new Map<PC.CameraComponent, boolean>();
  private readonly body = new Map<PC.MeshInstance, { visible: PC.MeshInstance['isVisibleFunc']; cull: boolean }>();
  private readonly boneRotations = new Map<PC.GraphNode, PC.Quat>();
  private head?: PC.GraphNode;
  private avatarYaw?: PC.GraphNode;
  private tracked?: PC.Entity;
  private headReference?: PC.Quat;
  private hands?: RigHands;
  private trackedHands = 0;
  private eyeHeight = 1.6;
  private standingHeight = 1.6;
  private originalExposure?: number;
  private settings: RenderSettings = { debug: true, width: 960, height: 540, fps: 30, tone: 'neutral', exposure: 1 };
  private keys = new Set<string>();
  private movement = { x: 0, z: 0 };
  private yaw = 0;
  private pitch = 0;
  private frames = 0;
  private frameTimes: number[] = [];
  private captureTimes: number[] = [];
  private captureMs = 0;
  get captureLatency(): number { return this.captureMs; }
  private lastXRRender = -Infinity;
  private xrRenderStarted = 0;
  private sceneScan = -Infinity;
  private sceneCameras: PC.CameraComponent[] = [];
  private lastCapture = 0;
  private lastInput = 0;
  private lastState = 0;
  private busy = false;
  private generation = 0;
  private waitingAck = false;
  private frameId = 0;
  private error: string | null = null;
  private connected = false;
  private hiddenBody = true;
  private xrPacket?: XRPacket;
  private tracking?: TrackingSpace;
  private trackingReset = false;
  private rightCamera?: PC.Entity;
  private uiCamera?: PC.Entity;
  private uiTexture?: PC.Texture;
  private uiTarget?: PC.RenderTarget;
  private uiCanvas?: OffscreenCanvas;
  private uiContext?: GPUCanvasContext;
  private lastUIFrame = 0;
  private previewUI?: PreviewUI;
  onUIFrame: (bitmap: ImageBitmap) => void = bitmap => bitmap.close();
  private originalAnimation?: () => void;
  private savedXRSettings?: RenderSettings;
  xrUI = 'dom';
  onXRFrame: (bitmap: ImageBitmap, packet: XRPacket) => void = bitmap => bitmap.close();
  canvas(): HTMLCanvasElement | undefined { const canvas = this.application?.graphicsDevice.canvas; return canvas instanceof HTMLCanvasElement ? canvas : undefined; }
  clickUI(x: number, y: number): void { const canvas = this.canvas(); if (!canvas) return; const box = canvas.getBoundingClientRect(); for (const name of ['mousemove', 'mousedown', 'mouseup']) canvas.dispatchEvent(new MouseEvent(name, { clientX: box.left + x / innerWidth * box.width, clientY: box.top + y / innerHeight * box.height, bubbles: true, cancelable: true, button: 0, buttons: name === 'mousedown' ? 1 : 0 })); }
  pointerUI(x: number, y: number, phase: 'down' | 'move' | 'up'): void { const canvas = this.canvas(); if (!canvas) return; const box = canvas.getBoundingClientRect(), event = { clientX: box.left + x / innerWidth * box.width, clientY: box.top + y / innerHeight * box.height, bubbles: true, cancelable: true, button: 0, buttons: phase === 'up' ? 0 : 1 }; canvas.dispatchEvent(new PointerEvent('pointer' + phase, { ...event, pointerId: 100, pointerType: 'touch', isPrimary: true })); canvas.dispatchEvent(new MouseEvent(phase === 'down' ? 'mousedown' : phase === 'up' ? 'mouseup' : 'mousemove', event)); }
  reportError(message: string): void { this.error = message; this.onState(this.status()); }
  onBeforeXRRender: (packet: XRPacket) => void = () => {};
  worldPose(pose: Pose): Pose | undefined { const root = player(); return root && this.tracking?.world(pose, vector(root.getPosition())); }
  turn(degrees: number): void { if (Number.isFinite(degrees)) this.tracking?.turn(degrees); }
  resetTracking(): void { this.trackingReset = true; }
  renderXR(packet: XRPacket, size: { width: number; height: number }): void {
    const a = this.application, pc = window.pc, cam = this.headCamera?.camera;
    if (!a || !pc || !cam) return;
    if (!this.xrPacket) {
      for (const light of a.root.findComponents('light') as PC.LightComponent[]) if (light.castShadows && light.shadowResolution > 512) { this.savedShadows.set(light, light.shadowResolution); light.shadowResolution = 512; }
      cam.layers = cam.layers.filter(layer => layer !== pc.LAYERID_UI);
      this.savedXRSettings = { ...this.settings }; this.originalAnimation = a.requestAnimationFrame;
      if (a.frameRequestId) cancelAnimationFrame(a.frameRequestId); a.frameRequestId = undefined; a.requestAnimationFrame = () => {};
      this.waitingAck = false; this.lastUIFrame = 0; this.lastXRRender = -Infinity; this.tracking = new TrackingSpace(this.eyeHeight, this.standingHeight); this.tracking.calibrate(packet.center, this.yaw);
      const right = this.rightCamera ||= new pc.Entity('ArcadeVRRightEye'); if (!right.parent) a.root.addChild(right); if (!right.camera) right.addComponent('camera', { layers: [...cam.layers], nearClip: cam.nearClip, farClip: cam.farClip, clearColor: cam.clearColor, priority: cam.priority + 1 });
      if (right.camera) { right.camera.gammaCorrection = cam.gammaCorrection; right.camera.toneMapping = cam.toneMapping; }
      this.setupUI();
    }
    if (this.trackingReset) { this.tracking?.calibrate(packet.center, this.yaw); this.trackingReset = false; }
    this.xrPacket = packet; this.lastInput = performance.now(); this.movement = packet.move; this.setKeys(new Set(packet.keys));
    if (this.busy || packet.time - this.lastXRRender < 1000 / 45 - 1) return;
    this.lastXRRender = packet.time;
    if (!this.busy && (this.settings.width !== size.width * 2 || this.settings.height !== size.height || !this.target)) {
      this.target?.destroy(); this.texture?.destroy(); this.captureContext?.unconfigure();
      this.settings = { ...this.settings, width: size.width * 2, height: size.height, fps: 45 };
      const device = a.graphicsDevice.wgpu; if (!device) { this.reportError('WebGPU engine unavailable'); return; }
      this.texture = new pc.Texture(a.graphicsDevice, { name: 'ArcadeVRStereo', width: this.settings.width, height: size.height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false });
      this.target = new pc.RenderTarget({ colorBuffer: this.texture, depth: true, samples: 1 });
      this.captureCanvas = new OffscreenCanvas(this.settings.width, size.height); this.captureContext = this.captureCanvas.getContext('webgpu') || undefined;
      this.captureContext?.configure({ device, format: 'rgba8unorm', alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST });
      cam.renderTarget = this.target; if (this.rightCamera?.camera) this.rightCamera.camera.renderTarget = this.target;
    }
    this.xrRenderStarted = performance.now();
    a.tick(packet.time);
  }
  endXR(reconnect = true): void {
    for (const [light, resolution] of this.savedShadows) if (light.entity.parent) light.shadowResolution = resolution; this.savedShadows.clear();
    const a = this.application, settings = this.savedXRSettings; this.xrPacket = undefined; this.tracking = undefined;
    if (a && this.originalAnimation) { a.requestAnimationFrame = this.originalAnimation; this.originalAnimation = undefined; a.requestAnimationFrame(); }
    this.rightCamera?.destroy(); this.rightCamera = undefined; this.uiCamera?.destroy(); this.uiTarget?.destroy(); this.uiTexture?.destroy(); this.uiContext?.unconfigure(); this.uiCamera = this.uiTarget = this.uiTexture = this.uiContext = this.uiCanvas = undefined; this.savedXRSettings = undefined; this.xrUI = 'dom';
    if (reconnect && settings && a) this.connect(settings);
  }
  onState: (state: RuntimeState) => void = () => {};
  private setupUI(): void {
    const a = this.application, pc = window.pc, device = a?.graphicsDevice.wgpu; if (!a || !pc || !device || this.uiCamera) return;
    this.uiTexture = new pc.Texture(a.graphicsDevice, { name: 'ArcadeVRHUD', width: 1280, height: 720, format: pc.PIXELFORMAT_RGBA8, mipmaps: false }); this.uiTarget = new pc.RenderTarget({ colorBuffer: this.uiTexture, depth: true, samples: 1 });
    const ui = this.uiCamera = new pc.Entity('ArcadeVRUICamera'); a.root.addChild(ui); ui.addComponent('camera', { layers: [pc.LAYERID_UI], renderTarget: this.uiTarget, clearColor: new pc.Color(0, 0, 0, 0), clearColorBuffer: true, clearDepthBuffer: true, priority: 200 });
    this.uiCanvas = new OffscreenCanvas(1280, 720); this.uiContext = this.uiCanvas.getContext('webgpu') || undefined; this.uiContext?.configure({ device, format: 'rgba8unorm', alphaMode: 'premultiplied', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST });
  }
  onFrame: (bitmap: ImageBitmap, id: number) => void = bitmap => bitmap.close();
  ready(): boolean { const a = app(), loading = Array.from(document.querySelectorAll('[role="progressbar"]')).some(node => node.getClientRects().length > 0 && (/loading|building world|assets|downloading/i.test(node.getAttribute('aria-label') || '') || /loading/i.test(node.closest('[role="status"]')?.querySelector('h1,h2')?.textContent || ''))); return !loading && !!player() && !!a && (a.root.findComponents('render').length + a.root.findComponents('model').length) > 0; }
  status(): RuntimeState {
    const p = player(), now = performance.now(); this.frameTimes = this.frameTimes.filter(time => now - time < 2000);
    this.captureTimes = this.captureTimes.filter(time => now - time < 2000); const captureElapsed = this.captureTimes.length > 1 ? now - (this.captureTimes[0] || now) : 0;
    const count = this.frameTimes.length, elapsed = count > 1 ? now - (this.frameTimes[0] || now) : 0;
    return { connected: this.connected, ready: this.ready(), backend: this.application?.graphicsDevice.deviceType || '', player: p ? { name: p.name, position: vector(p.getPosition()) } : null, look: { yaw: this.yaw, pitch: this.pitch }, camera: this.headCamera ? vector(this.headCamera.getPosition()) : null, frames: this.frames, renderFPS: elapsed > 0 ? (count - 1) * 1000 / elapsed : 0, captureFPS: captureElapsed > 0 ? (this.captureTimes.length - 1) * 1000 / captureElapsed : 0, captureMs: this.captureMs, dimensions: { width: this.settings.width, height: this.settings.height }, xr: { active: !!this.xrPacket, supported: !!navigator.xr, mode: this.xrPacket ? 'same-runtime-webgpu-stereo' : 'flat', ui: this.xrUI, hands: this.trackedHands }, error: this.error };
  }
  connect(settings: RenderSettings): RuntimeState {
    const a = app(), pc = window.pc, p = player(), input = inputManager();
    if (!this.ready() || !a || !pc || !p || !input) throw Error('Waiting for the game and player controls.');
    this.stop(); this.settings = { ...settings }; this.application = a; this.manager = input; this.originalExposure = a.scene.exposure; a.scene.exposure = settings.exposure;
    const gd = a.graphicsDevice, main = camera()?.camera;
    if (!main) throw Error('Waiting for the game camera.');
    this.originalSize = { width: gd.width, height: gd.height, ratio: gd.maxPixelRatio, mode: a.resolutionMode };
    gd.maxPixelRatio = 1; a.setCanvasResolution(pc.RESOLUTION_FIXED, settings.width, settings.height);
    const cam = this.headCamera = new pc.Entity('ArcadeVRPlayerCamera'); a.root.addChild(cam);
    cam.addComponent('camera', { clearColor: main.clearColor, nearClip: .1, farClip: main.farClip || 1000, fov: 80, priority: 100, layers: settings.debug ? [...main.layers].filter(layer => layer !== pc.LAYERID_UI) : [...main.layers], clearColorBuffer: true });
    if (!cam.camera) throw Error('Camera component could not be created.');
    for (const key of ['aperture', 'shutter', 'sensitivity'] as const) cam.camera[key] = main[key];
    cam.camera.toneMapping = settings.tone === 'aces' ? pc.TONEMAP_ACES : pc.TONEMAP_NEUTRAL; cam.camera.gammaCorrection = pc.GAMMA_SRGB;
    if (settings.debug) {
      if (!gd.wgpu) throw Error('Arcade requires WebGPU to capture the player camera.');
      this.texture = new pc.Texture(gd, { name: 'ArcadeVRPreview', width: settings.width, height: settings.height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false });
      this.target = new pc.RenderTarget({ colorBuffer: this.texture, depth: true, samples: 1 }); cam.camera.renderTarget = this.target;
      this.captureCanvas = new OffscreenCanvas(settings.width, settings.height); this.captureContext = this.captureCanvas.getContext('webgpu') || undefined;
      this.captureContext?.configure({ device: gd.wgpu, format: 'rgba8unorm', alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST });
      const right = this.rightCamera = new pc.Entity('ArcadeVRPreviewRightEye'); a.root.addChild(right); right.addComponent('camera', { layers: [...cam.camera.layers], renderTarget: this.target, nearClip: cam.camera.nearClip, farClip: cam.camera.farClip, clearColor: cam.camera.clearColor, priority: 101 });
      if (right.camera) { right.camera.toneMapping = cam.camera.toneMapping; right.camera.gammaCorrection = cam.camera.gammaCorrection; for (const key of ['aperture', 'shutter', 'sensitivity'] as const) right.camera[key] = cam.camera[key]; }
      this.previewUI = new PreviewUI(); this.setupUI();
    }
    const direction = p.getRotation().transformVector(new pc.Vec3(0, 0, 1)); this.yaw = Math.atan2(-direction.x, -direction.z) * 180 / Math.PI; this.pitch = 0;
    this.source = { id: 'arcade-vr-input', attach() {}, detach() {}, lastActivityAt: () => Date.now(), readMove: out => { const h = this.yaw * Math.PI / 180, mainYaw = this.cameraYaw() * Math.PI / 180, m = this.movement, length = Math.max(1, Math.hypot(m.x, m.z)); const x = Math.cos(h) * m.x + Math.sin(h) * m.z, z = -Math.sin(h) * m.x + Math.cos(h) * m.z; out.x = (Math.cos(mainYaw) * x - Math.sin(mainYaw) * z) / length; out.z = (Math.sin(mainYaw) * x + Math.cos(mainYaw) * z) / length; return Math.abs(m.x) + Math.abs(m.z) > .001; }, consumeLook: out => { out.x = out.y = 0; }, consumeWheel: () => 0, isJump: () => this.keys.has('Space'), isSprint: () => this.keys.has('ShiftLeft'), isCrouch: () => this.keys.has('KeyC'), isKeyPressed: () => false, isCodePressed: code => this.keys.has(code), readActions: (out, bindings) => { for (const [action, codes] of Object.entries(bindings)) if (codes.some(code => this.keys.has(code))) out[action] = 1; }, releaseAll: () => this.release() };
    input.addSource(this.source); this.connected = true; this.lastInput = performance.now(); this.frames = 0; this.frameTimes = []; this.captureTimes = []; this.error = null;
    a.on('prerender', this.beforeRender); a.on('postrender', this.afterRender);
    this.originalFrameEnd = gd.frameEnd; const original = this.originalFrameEnd; gd.frameEnd = () => { original.call(gd); void this.capture(); };
    this.beforeRender(); return this.status();
  }
  private cameraYaw(): number { const pc = window.pc, c = camera(); if (!pc || !c) return 0; const f = c.getRotation().transformVector(pc.Vec3.FORWARD); return Math.atan2(-f.x, -f.z) * 180 / Math.PI; }
  private beforeRender = (): void => {
    const p = player(), pc = window.pc, a = this.application, cam = this.headCamera?.camera;
    if (!this.connected || !p || !pc || !a || !cam) return;
    if (performance.now() - this.lastInput > 750) this.release(); this.afterRender();
    if (p !== this.tracked) { this.restoreBody(); this.tracked = p; this.sceneScan = -Infinity; this.headReference = undefined; const children = graphNodes(p); this.hands = new RigHands(children); this.head = children.find(node => /^(mixamorig:)?head$/i.test(node.name)); this.avatarYaw = children.find(node => /_MoldYaw$/.test(node.name)); this.eyeHeight = Math.max(.4, Math.min(4, this.head ? this.head.getPosition().y - p.getPosition().y + .08 : 1.6)); const feet = children.filter(node => /^(mixamorig:)?(Left|Right)(Foot|ToeBase)$/i.test(node.name)); this.standingHeight = this.head && feet.length ? Math.max(.4, Math.min(10, this.head.getPosition().y - Math.min(...feet.map(node => node.getPosition().y)) + .08)) : this.eyeHeight; if (this.tracking && this.xrPacket) { this.tracking.eyeHeight = this.eyeHeight; this.tracking.standingHeight = this.standingHeight; this.tracking.calibrate(this.xrPacket.center, this.yaw); } }
    const scan = performance.now() - this.sceneScan > 1000;
    if (scan) { this.sceneScan = performance.now(); this.sceneCameras = a.root.findComponents('camera') as PC.CameraComponent[]; }
    if (scan) for (const entity of nodes(p)) for (const mesh of [...entity.render?.meshInstances || [], ...entity.model?.meshInstances || []]) if (!this.body.has(mesh)) {
      const saved = { visible: mesh.isVisibleFunc, cull: mesh.cull }; this.body.set(mesh, saved); mesh.cull = true;
      mesh.isVisibleFunc = (view: PC.Camera) => this.hiddenBody && (view === cam.camera || view === this.rightCamera?.camera?.camera) ? false : saved.visible ? saved.visible.call(mesh, view) : !saved.cull || view.frustum.containsAabb(mesh.aabb);
    }
    if (!this.settings.debug || this.xrPacket) { for (const candidate of this.sceneCameras) if (candidate !== cam && candidate !== this.rightCamera?.camera && candidate !== this.uiCamera?.camera) { if (!this.savedCameras.has(candidate)) this.savedCameras.set(candidate, candidate.enabled); candidate.enabled = false; } }
    else cam.enabled = !this.busy && !this.waitingAck && performance.now() - this.lastCapture >= 1000 / this.settings.fps - 2;
    if (this.xrPacket && this.tracking) {
      const center = this.tracking.world(this.xrPacket.center, vector(p.getPosition()));
      const forward = rotateForward(center.orientation); this.yaw = Math.atan2(-forward.x, -forward.z) * 180 / Math.PI; this.pitch = Math.asin(Math.max(-1, Math.min(1, forward.y))) * 180 / Math.PI;
    }
    const pose = new pc.Quat().setFromEulerAngles(this.pitch, this.yaw, 0), body = new pc.Quat().setFromEulerAngles(0, this.yaw + 180, 0); p.setRotation(body);
    if (this.avatarYaw) { this.boneRotations.set(this.avatarYaw, this.avatarYaw.getLocalRotation().clone()); this.avatarYaw.setRotation(body); }
    if (this.head) { this.boneRotations.set(this.head, this.head.getLocalRotation().clone()); this.headReference ||= body.clone().invert().mul(this.head.getRotation()); this.head.setRotation(pose.clone().mul(new pc.Quat().setFromEulerAngles(0, 180, 0)).mul(this.headReference)); }
    const position = p.getPosition();
    this.headCamera?.setPosition(position.x, position.y + this.eyeHeight, position.z); this.headCamera?.setRotation(pose);
    if (this.settings.debug && !this.xrPacket && this.rightCamera?.camera) {
      const offset = pose.transformVector(new pc.Vec3(.032 * this.standingHeight / 1.7, 0, 0));
      this.headCamera?.setPosition(position.x - offset.x, position.y + this.eyeHeight - offset.y, position.z - offset.z);
      this.rightCamera.setPosition(position.x + offset.x, position.y + this.eyeHeight + offset.y, position.z + offset.z); this.rightCamera.setRotation(pose);
      const projection = new pc.Mat4().setPerspective(80, this.settings.width / 2 / this.settings.height, cam.nearClip, cam.farClip);
      for (const [index, eye] of [cam, this.rightCamera.camera].entries()) { const rect = new pc.Vec4(index * .5, 0, .5, 1); eye.rect = rect; eye.scissorRect = rect; eye.calculateProjection = matrix => matrix.copy(projection); eye.enabled = cam.enabled; }
    }
    if (this.uiCamera?.camera) this.uiCamera.camera.enabled = !this.busy && performance.now() - this.lastUIFrame >= 250;
    if (this.xrPacket && this.tracking) this.trackedHands = this.hands?.apply(this.xrPacket, this.tracking, p, bone => { if (!this.boneRotations.has(bone)) this.boneRotations.set(bone, bone.getLocalRotation().clone()); }) || 0;
    if (this.xrPacket) this.onBeforeXRRender(this.xrPacket);
    if (this.xrPacket && this.tracking) for (const eye of this.xrPacket.views) {
      const camera = eye.eye === 'left' ? this.headCamera : this.rightCamera, component = camera?.camera; if (!camera || !component) continue;
      const world = this.tracking.world(eye, vector(p.getPosition())); camera.setPosition(world.position.x, world.position.y, world.position.z); camera.setRotation(new pc.Quat(world.orientation.x, world.orientation.y, world.orientation.z, world.orientation.w));
      const rect = new pc.Vec4(eye.eye === 'left' ? 0 : .5, 0, .5, 1); component.rect = rect; component.scissorRect = rect; component.enabled = !this.busy;
      const projection = new pc.Mat4(); projection.set(eye.captureProjection || eye.projection); projection.data[14] = (projection.data[14] || 0) * this.tracking.scale; component.calculateProjection = matrix => matrix.copy(projection);
      component.nearClip = .05 * this.tracking.scale; component.farClip = 1000 * this.tracking.scale;
    }
  };
  private afterRender = (): void => { for (const [bone, rotation] of this.boneRotations) bone.setLocalRotation(rotation); this.boneRotations.clear(); };
  private async capture(): Promise<void> {
    const a = this.application, camera = this.headCamera; if (!a || !camera || !this.connected) return;
    const now = performance.now(); this.frameTimes.push(now);
    if (now - this.lastState > 200) { this.lastState = now; this.onState(this.status()); }
    if ((!this.settings.debug && !this.xrPacket) || !camera.camera?.enabled || this.busy || this.waitingAck || now - this.lastCapture < 1000 / this.settings.fps - 2) return;
    this.busy = true; this.lastCapture = now; const xrFrame = this.xrPacket, generation = this.generation;
    try {
      const gd = a.graphicsDevice, device = gd.wgpu, texture = this.texture as PC.Texture & { impl?: { gpuTexture?: GPUTexture } };
      if (!device || !texture?.impl?.gpuTexture || !this.captureContext || !this.captureCanvas) return;
      const uiTexture = this.uiTexture as (PC.Texture & { impl?: { gpuTexture?: GPUTexture } }) | undefined;
      const captureUI = !!this.uiCamera?.camera?.enabled && !!uiTexture?.impl?.gpuTexture && !!this.uiContext && !!this.uiCanvas;
      const encoder = device.createCommandEncoder(); if (captureUI && uiTexture?.impl?.gpuTexture && this.uiContext) encoder.copyTextureToTexture({ texture: uiTexture.impl.gpuTexture }, { texture: this.uiContext.getCurrentTexture() }, { width: 1280, height: 720 }); encoder.copyTextureToTexture({ texture: texture.impl.gpuTexture }, { texture: this.captureContext.getCurrentTexture() }, { width: this.settings.width, height: this.settings.height }); device.queue.submit([encoder.finish()]);
      const [bitmap, hud] = await capturePair(createImageBitmap(this.captureCanvas, { colorSpaceConversion: 'none' }), captureUI && this.uiCanvas ? createImageBitmap(this.uiCanvas, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }) : Promise.resolve(undefined));
      if (generation !== this.generation) { bitmap.close(); hud?.close(); return; }
      if (hud) { this.lastUIFrame = now; if (this.xrPacket) this.onUIFrame(hud); else if (this.previewUI) this.previewUI.setHUD(hud); else hud.close(); } if (!this.connected || camera !== this.headCamera) { bitmap.close(); return; }
      this.frames++; this.captureTimes.push(performance.now()); if (this.xrPacket && xrFrame) this.onXRFrame(bitmap, xrFrame); else { const preview = this.previewUI ? await this.previewUI.compose(bitmap) : bitmap; if (!this.connected || camera !== this.headCamera) preview.close(); else { this.waitingAck = true; this.onFrame(preview, ++this.frameId); } } this.captureMs = performance.now() - (this.xrPacket ? this.xrRenderStarted : now);
    } catch (error) { if (generation === this.generation) this.error = error instanceof Error ? error.message : String(error); } finally { if (generation === this.generation) this.busy = false; }
  }
  acknowledge(id: number): void { if (id === this.frameId) this.waitingAck = false; }
  input(data: { x: number; z: number; keys: string[] }): void { if (this.xrPacket) return; this.movement = { x: Math.max(-1, Math.min(1, finite(data.x))), z: Math.max(-1, Math.min(1, finite(data.z))) }; this.lastInput = performance.now(); this.setKeys(new Set(data.keys.filter(key => /^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|KeyC)$/.test(key)))); }
  look(yaw: number, pitch: number): void { this.yaw = ((finite(yaw) + 180) % 360 + 360) % 360 - 180; this.pitch = Math.max(-85, Math.min(85, finite(pitch))); this.beforeRender(); }
  bodyVisible(visible: boolean): void { this.hiddenBody = !visible; }
  private setKeys(next: Set<string>): void { const emit = (code: string, down: boolean) => { const key = code === 'Space' ? ' ' : code === 'ShiftLeft' ? 'Shift' : code.replace(/^(Key|Digit)/, '').toLowerCase(), keyCode = code === 'Space' ? 32 : code === 'ShiftLeft' ? 16 : key.toUpperCase().charCodeAt(0); window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key, keyCode, which: keyCode, bubbles: true, cancelable: true })); }; for (const key of this.keys) if (!next.has(key)) emit(key, false); for (const key of next) if (!this.keys.has(key)) emit(key, true); this.keys = next; }
  release(): void { this.setKeys(new Set()); this.movement = { x: 0, z: 0 }; }
  private restoreBody(): void { for (const [mesh, saved] of this.body) { mesh.isVisibleFunc = saved.visible; mesh.cull = saved.cull; } this.body.clear(); }
  stop(): void {
    this.generation++;
    if (this.xrPacket) this.endXR(false); this.release(); this.afterRender(); this.restoreBody(); const a = this.application; this.connected = false;
    this.previewUI?.destroy(); this.previewUI = undefined; this.rightCamera?.destroy(); this.rightCamera = undefined; this.uiCamera?.destroy(); this.uiTarget?.destroy(); this.uiTexture?.destroy(); this.uiContext?.unconfigure(); this.uiCamera = this.uiTarget = this.uiTexture = this.uiContext = this.uiCanvas = undefined;
    if (a) { if (this.originalExposure !== undefined) a.scene.exposure = this.originalExposure; a.off('prerender', this.beforeRender); a.off('postrender', this.afterRender); if (this.originalFrameEnd) a.graphicsDevice.frameEnd = this.originalFrameEnd; if (this.originalSize) { a.graphicsDevice.maxPixelRatio = this.originalSize.ratio; a.setCanvasResolution(this.originalSize.mode, this.originalSize.width / this.originalSize.ratio, this.originalSize.height / this.originalSize.ratio); } }
    for (const [cam, enabled] of this.savedCameras) if (cam.entity.parent) cam.enabled = enabled; this.savedCameras.clear();
    if (this.source) this.manager?.removeSource(this.source); this.source = undefined; this.manager = undefined;
    this.headCamera?.destroy(); this.target?.destroy(); this.texture?.destroy(); this.captureContext?.unconfigure();
    this.headCamera = this.target = this.texture = this.captureCanvas = this.captureContext = undefined;
    this.tracked = undefined; this.hands = undefined; this.trackedHands = 0; this.headReference = undefined; this.head = this.avatarYaw = undefined; this.busy = this.waitingAck = false;
  }
}
