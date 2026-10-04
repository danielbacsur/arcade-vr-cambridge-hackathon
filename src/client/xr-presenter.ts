import type { XRPacket, Pose, HandPose } from '../shared/protocol.js';
import { eyeDimensions, guardProjection, multiply } from './tracking.js';
import { dispatchFeatures, type FeatureContext } from './features.js';
import { WorldUI } from './world-ui.js';
import { AutomaticEntry } from './xr-entry.js';
import type { EngineController } from './engine.js';
import { FrameWatchdog } from './frame-watchdog.js';
const pose = (transform: XRRigidTransform): Pose => ({ position: { x: transform.position.x, y: transform.position.y, z: transform.position.z }, orientation: { x: transform.orientation.x, y: transform.orientation.y, z: transform.orientation.z, w: transform.orientation.w } });
export class XRPresenter {
  private session?: XRSession;
  private space?: XRReferenceSpace;
  private gl?: WebGL2RenderingContext;
  private layer?: XRWebGLLayer;
  private program?: WebGLProgram;
  private texture?: WebGLTexture;
  private vertex?: WebGLBuffer;
  private bitmap?: ImageBitmap;
  private captured?: XRPacket;
  private dirty = false;
  private supported = false;
  private ui?: WorldUI;
  private id = 0;
  private menuPressed = false;
  private readonly pointers = new Map<XRInputSource, { id: number; pressed: boolean; handled: boolean }>();
  private readonly watchdog = new FrameWatchdog();
  private failing = false;
  private featureContext?: FeatureContext;
  private renderScale = 1;
  private uploadedWidth = 0;
  private uploadedHeight = 0;
  private vignette = 0;
  private entry: AutomaticEntry;
  constructor(private readonly engine: EngineController) {
    this.entry = new AutomaticEntry({ supported: () => this.supported, ready: () => engine.ready(), active: () => !!this.session, request: () => this.start(), report: message => engine.reportError(message) });
    if (new URL(location.href).searchParams.get('xr') !== '1') return;
    void navigator.xr?.isSessionSupported('immersive-vr').then(supported => { this.supported = supported; });
    const enter = (event: Event) => { if (event.isTrusted) this.entry.tryEnter(true); };
    document.addEventListener('click', enter, true); document.addEventListener('keydown', enter, true);
    setInterval(() => this.entry.tryEnter(false), 500);
    window.addEventListener('pagehide', () => { void this.session?.end(); });
  }
  private start(): Promise<void> {
    if (!navigator.xr) return Promise.reject(Error('WebXR unavailable'));
    // Make the permission request before any awaited work consumes transient activation.
    const requested = navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] });
    return this.initialize(requested);
  }
  private async initialize(requested: Promise<XRSession>): Promise<void> {
    const session = await requested; this.session = session;
    this.failing = false; this.watchdog.reset(performance.now());
    session.addEventListener('end', this.end, { once: true });
    try {
      const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: false, xrCompatible: true });
      if (!gl) throw Error('WebGL XR display unavailable'); await gl.makeXRCompatible(); this.gl = gl;
      canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.fail('VR display was interrupted. Tap the game to resume VR.'); });
      session.addEventListener('visibilitychange', () => { this.releasePointers(); this.engine.release(); this.watchdog.reset(performance.now()); if (session.visibilityState === 'visible') this.engine.resetTracking(); });
      this.layer = new XRWebGLLayer(session, gl, { alpha: false, antialias: false, depth: false, framebufferScaleFactor: 1 }); session.updateRenderState({ baseLayer: this.layer, depthNear: .05, depthFar: 1000 });
      this.space = await session.requestReferenceSpace('local-floor'); this.space.addEventListener('reset', () => this.engine.resetTracking());
      this.program = createStereoProgram(gl); this.texture = gl.createTexture() || undefined; this.vertex = gl.createBuffer() || undefined;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex || null); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.bindTexture(gl.TEXTURE_2D, this.texture || null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.engine.onXRFrame = (bitmap, packet) => { if (this.session !== session || this.failing) { bitmap.close(); return; } this.watchdog.reset(performance.now()); this.bitmap?.close(); this.bitmap = bitmap; this.captured = packet; this.dirty = true; };
      document.documentElement.classList.add('arcade-xr-active'); this.engine.xrUI = 'head-locked-hud';
      this.ui = new WorldUI(gl, message => this.engine.reportError(message), true, (x, y, phase) => phase ? this.engine.pointerUI(x, y, phase) : this.engine.clickUI(x, y), { width: 1920, height: 1080 }, { followHead: true, handPointer: true }); this.engine.onUIFrame = bitmap => { if (this.ui) this.ui.setEngineBitmap(bitmap); else bitmap.close(); };
      const canvasElement = this.engine.canvas(); if (canvasElement) canvasElement.dataset.arcadeVrEngine = 'true';
      const selection = (event: XRInputSourceEvent, pressed: boolean) => { if (!this.space || !this.ui || event.inputSource.hand) return; const head = event.frame.getViewerPose(this.space), ray = event.frame.getPose(event.inputSource.targetRaySpace, this.space); if (head) this.ui.anchor(pose(head.transform)); this.updatePointer(event.inputSource, ray ? pose(ray.transform) : undefined, pressed); };
      session.addEventListener('selectstart', event => selection(event, true)); session.addEventListener('selectend', event => selection(event, false));
      this.featureContext = { engine: this.engine, session, space: this.space, gl, ui: this.ui, setRenderScale: value => { if (Number.isFinite(value)) this.renderScale = Math.max(.6, Math.min(1, value)); }, setVignette: value => { if (Number.isFinite(value)) this.vignette = Math.max(0, Math.min(.8, value)); } };
      this.engine.onBeforeXRRender = packet => { if (this.featureContext) dispatchFeatures({ type: 'render', context: this.featureContext, packet }); };
      dispatchFeatures({ type: 'start', context: this.featureContext });
      session.requestAnimationFrame(this.frame);
    } catch (error) { await session.end(); throw error; }
  }
  private frame = (time: number, frame: XRFrame): void => {
    const session = this.session, space = this.space, gl = this.gl, layer = this.layer; if (!session || !space || !gl || !layer) return;
    if (this.failing) return;
    if (this.watchdog.stalled(performance.now(), session.visibilityState === 'visible')) { this.fail('VR rendering stopped. Tap the game to resume VR.'); return; }
    if (gl.isContextLost()) { this.fail('VR display was interrupted. Tap the game to resume VR.'); return; }
    if (session.visibilityState === 'hidden') { this.releasePointers(); this.engine.release(); this.watchdog.reset(performance.now()); session.requestAnimationFrame(this.frame); return; }
    session.requestAnimationFrame(this.frame); const viewer = frame.getViewerPose(space); if (!viewer || viewer.views.length !== 2) { this.releasePointers(); this.engine.release(); return; }
    const center = pose(viewer.transform); this.ui?.anchor(center); this.ui?.hover(); const seen = new Set<XRInputSource>();
    const views = viewer.views.map(view => { const viewport = layer.getViewport(view); if (!viewport) throw Error('Missing eye viewport'); return { ...pose(view.transform), eye: view.eye as 'left' | 'right', projection: Array.from(view.projectionMatrix), captureProjection: guardProjection(Array.from(view.projectionMatrix)), viewport: { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height } }; });
    const hands: HandPose[] = []; let menuPressed = false; let move = { x: 0, z: 0 }; const keys: string[] = [];
    for (const source of session.inputSources) {
      if (source.handedness !== 'left' && source.handedness !== 'right') continue;
      const grip = source.gripSpace ? frame.getPose(source.gripSpace, space) : null;
      const hand: HandPose = { side: source.handedness, grip: grip ? pose(grip.transform) : undefined, pinch: 0, trigger: source.gamepad?.buttons[0]?.value || 0 };
      if (source.hand) { hand.joints = {}; for (const [name, joint] of source.hand) { const jointPose = frame.getJointPose?.(joint, space); if (jointPose) hand.joints[name] = pose(jointPose.transform); }
        const thumb = hand.joints['thumb-tip']?.position, finger = hand.joints['index-finger-tip']?.position; if (thumb && finger) hand.pinch = Math.hypot(thumb.x - finger.x, thumb.y - finger.y, thumb.z - finger.z) < .025 ? 1 : 0;
      }
      hands.push(hand); const controller = !source.hand ? source.gamepad : undefined; const axes = controller?.axes;
      seen.add(source); const targetRay = frame.getPose(source.targetRaySpace, space), ray = targetRay ? pose(targetRay.transform) : undefined;
      if (ray && source.handedness === 'right') this.ui?.hover(ray);
      if (source.hand && source.handedness === 'right') { const thumb = hand.joints?.['thumb-tip']?.position, finger = hand.joints?.['index-finger-tip']?.position; const pressed = !!thumb && !!finger && Math.hypot(thumb.x - finger.x, thumb.y - finger.y, thumb.z - finger.z) < (this.pointers.get(source)?.pressed ? .04 : .025); this.updatePointer(source, ray, pressed); }
      else if (!source.hand && this.pointers.get(source)?.pressed) this.updatePointer(source, ray, true);
      if (source.handedness === 'left' && axes) move = { x: Math.abs(axes[2] || axes[0] || 0) > .15 ? axes[2] || axes[0] || 0 : 0, z: Math.abs(axes[3] || axes[1] || 0) > .15 ? axes[3] || axes[1] || 0 : 0 };
      if (source.handedness === 'right' && controller?.buttons[4]?.pressed) keys.push('Space');
      if (source.handedness === 'left' && controller?.buttons[4]?.pressed) keys.push('ShiftLeft');
      if (source.handedness === 'left' && controller?.buttons[5]?.pressed) menuPressed = true;
    }
    for (const source of this.pointers.keys()) if (!seen.has(source)) { const pointer = this.pointers.get(source); if (pointer) this.ui?.pointer(undefined, 'up', pointer.id); this.pointers.delete(source); }
    const packet: XRPacket = { frameId: ++this.id, time, center, views, hands, move, keys };
    if (this.featureContext) dispatchFeatures({ type: 'frame', context: this.featureContext, packet, frame });
    const size = eyeDimensions((views[0]?.viewport.width || 1) * this.renderScale, (views[0]?.viewport.height || 1) * this.renderScale, 2048, 2048);
    if (menuPressed && !this.menuPressed) this.ui?.anchor(packet.center); this.menuPressed = menuPressed;
    this.engine.renderXR(packet, size); this.ui?.update(time);
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!this.bitmap || !this.program) return;
    gl.useProgram(this.program); gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex || null); const attribute = gl.getAttribLocation(this.program, 'position'); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture || null); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); if (this.dirty) { if (this.uploadedWidth === this.bitmap.width && this.uploadedHeight === this.bitmap.height) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.bitmap); else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.bitmap); this.uploadedWidth = this.bitmap.width; this.uploadedHeight = this.bitmap.height; } this.dirty = false; }
    for (const view of views) {
      gl.useProgram(this.program); gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex || null); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0); gl.bindTexture(gl.TEXTURE_2D, this.texture || null);
      const captured = this.captured?.views.find(eye => eye.eye === view.eye), pc = window.pc; if (!captured || !pc) continue;
      const old = captured.orientation, delta = multiply({ x: -old.x, y: -old.y, z: -old.z, w: old.w }, view.orientation);
      const inverse = new pc.Mat4().set(view.projection).invert();
      gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'inverseProjection'), false, inverse.data);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'oldProjection'), false, new Float32Array(captured.captureProjection || captured.projection));
      gl.uniform4f(gl.getUniformLocation(this.program, 'rotation'), delta.x, delta.y, delta.z, delta.w);
      const viewport = view.viewport; gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height); gl.uniform1f(gl.getUniformLocation(this.program, 'vignette'), this.vignette); gl.uniform1f(gl.getUniformLocation(this.program, 'eye'), view.eye === 'left' ? 0 : 1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); const xrView = viewer.views.find(eye => eye.eye === view.eye); if (xrView) this.ui?.draw(xrView.projectionMatrix, xrView.transform.inverse.matrix, packet.center); if (this.featureContext) dispatchFeatures({ type: 'eye', context: this.featureContext, eye: view }); }
  };

  private updatePointer(source: XRInputSource, ray: Pose | undefined, pressed: boolean): void {
    let pointer = this.pointers.get(source); if (!pointer) { pointer = { id: source.handedness === 'left' ? 200 : 201, pressed: false, handled: false }; this.pointers.set(source, pointer); }
    if (!ray) pressed = false;
    if (pressed && !pointer.pressed) pointer.handled = this.ui?.pointer(ray, 'down', pointer.id) || false;
    else if (pressed) this.ui?.pointer(ray, 'move', pointer.id);
    else if (pointer.pressed) { this.ui?.pointer(ray, 'up', pointer.id); if (ray && this.featureContext) dispatchFeatures({ type: 'select', context: this.featureContext, source, handled: pointer.handled }); }
    pointer.pressed = pressed;
  }
  private releasePointers(): void { this.ui?.releasePointers(); this.pointers.clear(); }
  private fail(message: string): void { if (this.failing) return; this.failing = true; const session = this.session; if (session) void session.end().catch(() => { if (this.session === session) this.end(); }).finally(() => this.engine.reportError(message)); }

  private end = (): void => { this.releasePointers(); if (this.featureContext) dispatchFeatures({ type: 'end', context: this.featureContext }); this.featureContext = undefined; this.engine.onBeforeXRRender = () => {}; this.renderScale = 1; this.uploadedWidth = this.uploadedHeight = 0; this.vignette = 0; this.ui?.destroy(); this.ui = undefined; const canvas = this.engine.canvas(); if (canvas) delete canvas.dataset.arcadeVrEngine; this.engine.endXR(); this.bitmap?.close(); this.bitmap = undefined; this.captured = undefined; this.dirty = false; if (this.gl) { this.gl.deleteTexture(this.texture || null); this.gl.deleteBuffer(this.vertex || null); this.gl.deleteProgram(this.program || null); } this.session = this.space = this.layer = this.gl = this.program = this.texture = this.vertex = undefined; document.documentElement.classList.remove('arcade-xr-active'); };
}

export function createStereoProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const shader = (type: number, source: string) => { const value = gl.createShader(type); if (!value) throw Error('Shader unavailable'); gl.shaderSource(value, source); gl.compileShader(value); if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(value) || 'Shader failed'); return value; };
    const vertex = shader(gl.VERTEX_SHADER, '#version 300 es\nin vec2 position;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}');
    const fragment = shader(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;in vec2 uv;uniform sampler2D image;uniform float eye;uniform float vignette;uniform mat4 inverseProjection;uniform mat4 oldProjection;uniform vec4 rotation;out vec4 color;void main(){vec4 ray=inverseProjection*vec4(uv*2.-1.,1.,1.);vec3 direction=ray.xyz/ray.w;direction+=2.*cross(rotation.xyz,cross(rotation.xyz,direction)+rotation.w*direction);vec4 clip=oldProjection*vec4(direction,0.);vec2 sampleUV=clip.xy/clip.w*.5+.5;if(clip.w<=0.){color=vec4(0.,0.,0.,1.);}else{color=texture(image,vec2((clamp(sampleUV.x,.001,.999)+eye)*.5,1.-clamp(sampleUV.y,.001,.999)));color.rgb*=1.-vignette*smoothstep(.25,.65,length(uv-.5));}}');
    const program = gl.createProgram(); if (!program) throw Error('Program unavailable'); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program) || 'Program failed'); return program;
  }
