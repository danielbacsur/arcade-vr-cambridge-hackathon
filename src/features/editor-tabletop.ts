import '../client/globals.js';
import { app } from '../client/engine.js';
import type { EngineApplication } from '../client/globals.js';
import { AutomaticEntry } from '../client/xr-entry.js';
import { WorldUI } from '../client/world-ui.js';
import { panelHit } from '../client/ui-hit.js';
import { rotate } from '../client/tracking.js';
import { editorPointer } from '../client/editor-pointer.js';
import type { Pose } from '../shared/protocol.js';
const transformPose = (transform: XRRigidTransform): Pose => ({ position: { x: transform.position.x, y: transform.position.y, z: transform.position.z }, orientation: { x: transform.orientation.x, y: transform.orientation.y, z: transform.orientation.z, w: transform.orientation.w } });
class EditorTabletop {
  private supported = false;
  private session?: XRSession;
  private space?: XRReferenceSpace;
  private layer?: XRWebGLLayer;
  private gl?: WebGL2RenderingContext;
  private ui?: WorldUI;
  private panel?: Pose;
  private application?: EngineApplication;
  private originalAnimation?: () => void;
  private originalSize?: { width: number; height: number; ratio: number; mode: string };
  private originalFrameEnd?: () => void;
  private drag?: { source: XRInputSource; button: number; x: number; y: number };
  private copying = false;
  private lastCopy = 0;
  private lastTick = 0;
  private layout = { width: 1920, height: 1080 };
  private width = 2.4;
  private height = 1.35;
  constructor() {
    if (location.pathname !== '/' || !new URL(location.href).searchParams.has('projectId') || !navigator.xr) return;
    void navigator.xr.isSessionSupported('immersive-vr').then(value => { this.supported = value; });
    const entry = new AutomaticEntry({ supported: () => this.supported, ready: () => !!app()?.root.findComponents('camera').length, active: () => !!this.session, request: () => this.start(), report: message => console.warn('[Arcade editor VR]', message) });
    document.addEventListener('click', event => { if (event.isTrusted) entry.tryEnter(true); }, true);
    setInterval(() => entry.tryEnter(false), 500);
    window.addEventListener('pagehide', () => { void this.session?.end(); });
  }
  private start(): Promise<void> { const requested = navigator.xr?.requestSession('immersive-vr', { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] }); return requested ? this.initialize(requested) : Promise.reject(Error('WebXR unavailable')); }
  private async initialize(requested: Promise<XRSession>): Promise<void> {
    const session = this.session = await requested; session.addEventListener('end', this.end, { once: true });
    try {
      const application = this.application = app(); if (!application) throw Error('Editor not ready'); const canvas = application.graphicsDevice.canvas; if (!(canvas instanceof HTMLCanvasElement)) throw Error('Editor canvas missing');
      const gl = document.createElement('canvas').getContext('webgl2', { alpha: false, xrCompatible: true, antialias: false, depth: false }); if (!gl) throw Error('XR display unavailable'); this.gl = gl; await gl.makeXRCompatible();
      this.layer = new XRWebGLLayer(session, gl, { alpha: false, antialias: false, depth: false }); session.updateRenderState({ baseLayer: this.layer }); this.space = await session.requestReferenceSpace('local-floor');
      this.layout = { width: window.innerWidth, height: window.innerHeight }; this.width = Math.min(2.4, 1.5 * this.layout.width / this.layout.height); this.height = this.width * this.layout.height / this.layout.width;
      this.ui = new WorldUI(gl, message => console.warn(message), true, (x, y) => { editorPointer(canvas, 'down', x, y); editorPointer(canvas, 'up', x, y); }, this.layout);
      canvas.dataset.arcadeVrEngine = 'true'; document.documentElement.classList.add('arcade-editor-xr');
      this.originalSize = { width: application.graphicsDevice.width, height: application.graphicsDevice.height, ratio: application.graphicsDevice.maxPixelRatio, mode: application.resolutionMode };
      application.graphicsDevice.maxPixelRatio = 1; const scale = Math.min(1, 1920 / this.layout.width, 1080 / this.layout.height); application.setCanvasResolution(window.pc?.RESOLUTION_FIXED || 'FIXED', Math.round(this.layout.width * scale), Math.round(this.layout.height * scale));
      this.originalAnimation = application.requestAnimationFrame; if (application.frameRequestId) cancelAnimationFrame(application.frameRequestId); application.frameRequestId = undefined; application.requestAnimationFrame = () => {};
      const original = this.originalFrameEnd = application.graphicsDevice.frameEnd; application.graphicsDevice.frameEnd = () => { original.call(application.graphicsDevice); void this.copyScene(canvas); };
      session.addEventListener('selectstart', event => this.begin(event)); session.addEventListener('selectend', () => this.release()); session.addEventListener('select', event => { if (!this.space) return; const ray = event.frame.getPose(event.inputSource.targetRaySpace, this.space); const point = ray && this.point(transformPose(ray.transform)); if (point && this.interactive(point.x, point.y)) this.ui?.click(transformPose(ray.transform)); });
      session.requestAnimationFrame(this.frame);
    } catch (error) { await session.end(); throw error; }
  }
  private async copyScene(canvas: HTMLCanvasElement): Promise<void> {
    if (this.copying || performance.now() - this.lastCopy < 33) return; this.copying = true; this.lastCopy = performance.now();
    try { const bitmap = await createImageBitmap(canvas); if (this.session && this.ui) this.ui.setEngineBitmap(bitmap); else bitmap.close(); } catch { /* Preserve the editor's own error state. */ } finally { this.copying = false; }
  }
  private interactive(x: number, y: number): boolean { const target = document.elementFromPoint(x, y); if (target?.closest('button,input,select,textarea,a,[role="button"],[tabindex]')) return true; for (let node = target; node && node !== document.body; node = node.parentElement) if (getComputedStyle(node).cursor === 'pointer') return true; return false; }
  private point(ray: Pose): { x: number; y: number } | null { if (!this.panel) return null; const hit = panelHit(ray, this.panel, this.width, this.height); return hit ? { x: hit.u * this.layout.width, y: hit.v * this.layout.height } : null; }
  private begin(event: XRInputSourceEvent): void { if (this.drag || !this.space) return; const ray = event.frame.getPose(event.inputSource.targetRaySpace, this.space), point = ray && this.point(transformPose(ray.transform)); const canvas = this.application?.graphicsDevice.canvas; if (!point || !(canvas instanceof HTMLCanvasElement) || this.interactive(point.x, point.y)) return; this.drag = { source: event.inputSource, button: 0, ...point }; editorPointer(canvas, 'down', point.x, point.y); }
  private release(): void { const canvas = this.application?.graphicsDevice.canvas; if (this.drag && canvas instanceof HTMLCanvasElement) editorPointer(canvas, 'up', this.drag.x, this.drag.y, this.drag.button); this.drag = undefined; }
  private frame = (time: number, frame: XRFrame): void => {
    const session = this.session, space = this.space, layer = this.layer, gl = this.gl, application = this.application; if (!session || !space || !layer || !gl || !application) return; session.requestAnimationFrame(this.frame); const viewer = frame.getViewerPose(space); if (!viewer) return; const head = transformPose(viewer.transform);
    if (!this.panel) { const forward = rotate(head.orientation, { x: 0, y: 0, z: -1 }), yaw = Math.atan2(-forward.x, -forward.z); this.panel = { position: { x: head.position.x - Math.sin(yaw) * 2, y: head.position.y - .1, z: head.position.z - Math.cos(yaw) * 2 }, orientation: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) } }; this.ui?.anchor(head); }
    for (const source of session.inputSources) {
      const ray = frame.getPose(source.targetRaySpace, space), point = ray && this.point(transformPose(ray.transform)), squeeze = !!source.gamepad?.buttons[1]?.pressed, canvas = application.graphicsDevice.canvas;
      if (!point || !(canvas instanceof HTMLCanvasElement)) continue;
      if (squeeze && !this.drag && !this.interactive(point.x, point.y)) { this.drag = { source, button: source.handedness === 'left' ? 1 : 2, ...point }; editorPointer(canvas, 'down', point.x, point.y, this.drag.button); }
      if (this.drag?.source === source) { this.drag.x = point.x; this.drag.y = point.y; editorPointer(canvas, 'move', point.x, point.y, this.drag.button); if (this.drag.button !== 0 && !squeeze) this.release(); }
    }
    if (time - this.lastTick >= 33) { this.lastTick = time; application.tick(time); } this.ui?.update(time); gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer); gl.clearColor(.015, .015, .015, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    for (const view of viewer.views) { const viewport = layer.getViewport(view); if (viewport) { gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height); this.ui?.draw(view.projectionMatrix, view.transform.inverse.matrix, head); } }
  };
  private end = (): void => { this.release(); this.ui?.destroy(); this.ui = undefined; const application = this.application; if (application) { if (this.originalFrameEnd) application.graphicsDevice.frameEnd = this.originalFrameEnd; if (this.originalAnimation) { application.requestAnimationFrame = this.originalAnimation; application.requestAnimationFrame(); } if (this.originalSize) { application.graphicsDevice.maxPixelRatio = this.originalSize.ratio; application.setCanvasResolution(this.originalSize.mode, this.originalSize.width / this.originalSize.ratio, this.originalSize.height / this.originalSize.ratio); } const canvas = application.graphicsDevice.canvas; if (canvas instanceof HTMLCanvasElement) delete canvas.dataset.arcadeVrEngine; } this.session = this.space = this.layer = this.gl = undefined; this.panel = undefined; document.documentElement.classList.remove('arcade-editor-xr'); };
}
const style = document.createElement('style'); style.textContent = '.arcade-editor-xr,.arcade-editor-xr body,.arcade-editor-xr #root{background:transparent!important}'; document.head.append(style);
new EditorTabletop();
