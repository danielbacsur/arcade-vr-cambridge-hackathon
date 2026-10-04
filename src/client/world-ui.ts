import { toCanvas } from 'html-to-image';
import type { Pose } from '../shared/protocol.js';
import { panelHit } from './ui-hit.js';
import { rotate } from './tracking.js';
import { hudAnchor } from './hud-controls.js';
export class WorldUI {
  private panel?: Pose;
  private canvas?: HTMLCanvasElement;
  private texture: WebGLTexture | null;
  private engineTexture: WebGLTexture | null;
  private engineBitmap?: ImageBitmap;
  private engineUpdated = false;
  private readonly hitCanvas = document.createElement('canvas');
  private program: WebGLProgram;
  private buffer: WebGLBuffer | null;
  private busy = false;
  private dirty = true;
  private stopped = false;
  private captured = 0;
  private updated = true;
  private readonly observer: MutationObserver;
  private readonly width: number;
  private readonly height: number;
  private readonly controls = document.createElement('canvas');
  private controlsTexture: WebGLTexture | null;
  private cursor?: { x: number; y: number };
  private controlsState = "";
  private readonly pointers = new Map<number, { target?: HTMLElement; x: number; y: number; engine: boolean }>();
  constructor(private readonly gl: WebGL2RenderingContext, private readonly onError: (message: string) => void, private readonly captureDOM = true, private readonly engineClick: (x: number, y: number, phase?: 'down' | 'move' | 'up') => void = () => {}, private readonly layout = { width: 1920, height: 1080 }, private readonly options = { followHead: false, handPointer: false }) {
    this.width = Math.min(2.4, 1.5 * layout.width / layout.height); this.height = this.width * layout.height / layout.width;
    this.texture = gl.createTexture(); this.engineTexture = gl.createTexture(); this.hitCanvas.width = 192; this.hitCanvas.height = 108; this.buffer = gl.createBuffer();
    this.controls.width = 480; this.controls.height = 270; this.controlsTexture = gl.createTexture();
    const shader = (kind: number, source: string) => { const value = gl.createShader(kind); if (!value) throw Error('UI shader unavailable'); gl.shaderSource(value, source); gl.compileShader(value); if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(value) || 'UI shader failed'); return value; };
    const vertex = shader(gl.VERTEX_SHADER, '#version 300 es\nin vec2 position;uniform mat4 projection;uniform mat4 view;uniform mat4 model;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=projection*view*model*vec4(position.x*1.2,position.y*.675,0.,1.);}');
    const fragment = shader(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;in vec2 uv;uniform sampler2D image;out vec4 color;void main(){color=texture(image,vec2(uv.x,1.-uv.y));}');
    const program = gl.createProgram(); if (!program) throw Error('UI program unavailable'); this.program = program; gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program) || 'UI link failed');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.observer = new MutationObserver(() => { this.dirty = true; }); this.observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    document.addEventListener('input', this.invalidate, true); window.addEventListener('resize', this.invalidate); document.addEventListener('visibilitychange', this.invalidate);
  }
  setEngineBitmap(bitmap: ImageBitmap): void { this.engineBitmap?.close(); this.engineBitmap = bitmap; this.engineUpdated = true; const context = this.hitCanvas.getContext('2d', { willReadFrequently: true }); context?.clearRect(0, 0, 192, 108); context?.drawImage(bitmap, 0, 0, 192, 108); }
  private invalidate = (): void => { this.dirty = true; };
  anchor(head: Pose): void { if (this.options.followHead) { this.panel = hudAnchor(head); return; } const forward = rotate(head.orientation, { x: 0, y: 0, z: -1 }), yaw = Math.atan2(-forward.x, -forward.z) / 2; this.panel = { position: { x: head.position.x + Math.sin(yaw * 2) * -2, y: head.position.y - .1, z: head.position.z - Math.cos(yaw * 2) * 2 }, orientation: { x: 0, y: Math.sin(yaw), z: 0, w: Math.cos(yaw) } }; }
  update(time: number): void { if (!this.captureDOM || this.stopped || this.busy || (!this.dirty && time - this.captured < 1000) || time - this.captured < 250) return; this.busy = true; this.dirty = false; this.captured = time;
    void toCanvas(document.body, { width: this.layout.width, height: this.layout.height, canvasWidth: this.layout.width, canvasHeight: this.layout.height, pixelRatio: 1, backgroundColor: 'transparent', skipFonts: true, filter: node => !(node instanceof HTMLCanvasElement && node.dataset.arcadeVrEngine === 'true'), style: { background: 'transparent', width: this.layout.width + 'px', height: this.layout.height + 'px' } }).then(canvas => { if (!this.stopped) { this.canvas = canvas; this.updated = true; } }).catch(() => { this.dirty = true; this.onError('Some game UI could not be captured. DOM overlays remain the preferred path.'); }).finally(() => { this.busy = false; });
  }
  draw(projection: Float32Array, view: Float32Array, head: Pose): void {
    const pc = window.pc, gl = this.gl; if ((!this.canvas && !this.engineBitmap && !this.options.handPointer) || !pc) return; if (this.options.followHead || !this.panel) this.anchor(head);
    const panel = this.panel; if (!panel) return;
    const model = new pc.Mat4().setTRS(new pc.Vec3(panel.position.x, panel.position.y, panel.position.z), new pc.Quat(panel.orientation.x, panel.orientation.y, panel.orientation.z, panel.orientation.w), new pc.Vec3(this.width / 2.4, this.height / 1.35, 1));
    gl.useProgram(this.program); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); const attribute = gl.getAttribLocation(this.program, 'position'); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'projection'), false, projection); gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'view'), false, view); gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'model'), false, model.data);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const draw = (texture: WebGLTexture | null, image: HTMLCanvasElement | ImageBitmap, updated: boolean) => {
      gl.bindTexture(gl.TEXTURE_2D, texture); if (updated) { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); } gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    if (this.engineBitmap) { draw(this.engineTexture, this.engineBitmap, this.engineUpdated); this.engineUpdated = false; }
    if (this.canvas) { draw(this.texture, this.canvas, this.updated); this.updated = false; }
    if (this.options.handPointer) { draw(this.controlsTexture, this.controls, this.drawControls()); }
    gl.disable(gl.BLEND);
  }
  hover(ray?: Pose): void { const hit = ray && this.panel && panelHit(ray, this.panel, this.width, this.height); this.cursor = hit ? { x: hit.u * 1920, y: hit.v * 1080 } : undefined; }
  private drawControls(): boolean {
    const state = JSON.stringify(this.cursor && [Math.round(this.cursor.x), Math.round(this.cursor.y)]); if (state === this.controlsState) return false; this.controlsState = state;
    const ctx = this.controls.getContext('2d'); if (!ctx) return false; ctx.setTransform(.25, 0, 0, .25, 0, 0); ctx.clearRect(0, 0, 1920, 1080);
    if (this.cursor) { ctx.strokeStyle = '#7fffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(this.cursor.x, this.cursor.y, 13, 0, Math.PI * 2); ctx.stroke(); }
    return true;
  }
  releasePointers(): void { for (const [id, pointer] of this.pointers) this.emitPointer(id, 'up', pointer, false); this.pointers.clear(); this.cursor = undefined; }
  private emitPointer(id: number, phase: 'down' | 'move' | 'up', pointer: { target?: HTMLElement; x: number; y: number; engine: boolean }, click: boolean): void {
    const { target, x, y } = pointer; if (pointer.engine) { this.engineClick(x, y, phase); return; } if (!target) return;
    const event = { clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: phase === 'up' ? 0 : 1 };
    target.dispatchEvent(new PointerEvent('pointer' + phase, { ...event, pointerId: id, pointerType: 'touch', isPrimary: true }));
    target.dispatchEvent(new MouseEvent(phase === 'down' ? 'mousedown' : phase === 'up' ? 'mouseup' : 'mousemove', event));
    if (typeof Touch !== 'undefined' && typeof TouchEvent !== 'undefined') { const touch = new Touch({ identifier: id, target, clientX: x, clientY: y, pageX: x + scrollX, pageY: y + scrollY }); target.dispatchEvent(new TouchEvent(phase === 'down' ? 'touchstart' : phase === 'up' ? 'touchend' : 'touchmove', { bubbles: true, cancelable: true, touches: phase === 'up' ? [] : [touch], targetTouches: phase === 'up' ? [] : [touch], changedTouches: [touch] })); }
    if (phase === 'up' && click) target.click(); this.dirty = true;
  }
  pointer(ray: Pose | undefined, phase: 'down' | 'move' | 'up', id = 100): boolean {
    const hit = ray && this.panel && panelHit(ray, this.panel, this.width, this.height), x = hit ? hit.u * this.layout.width : -9999, y = hit ? hit.v * this.layout.height : -9999;
    const held = this.pointers.get(id);
    if (held) { if (hit) { held.x = x; held.y = y; } this.emitPointer(id, phase, held, phase === 'up' && !!hit); if (phase === 'up') this.pointers.delete(id); return true; }
    if (phase !== 'down' || !hit) return false;
    const hitElement = this.captureDOM ? document.elementFromPoint(x, y) : null;
    let candidate = hitElement?.closest('button,input,select,textarea,a,[role="button"],[role="slider"],[role="application"],[tabindex]') || null;
    if (!candidate) for (let node = hitElement; node && node !== document.body; node = node.parentElement) if (node instanceof HTMLElement && (getComputedStyle(node).cursor === 'pointer' || /joystick|dpad|touch-control/i.test(node.id + ' ' + node.className))) { candidate = node; break; }
    const target = candidate instanceof HTMLElement ? candidate : undefined;
    const alpha = this.hitCanvas.getContext('2d', { willReadFrequently: true })?.getImageData(Math.min(191, Math.floor(hit.u * 192)), Math.min(107, Math.floor(hit.v * 108)), 1, 1).data[3] || 0;
    if (!target && alpha <= 10) return false;
    const pointer = { target, x, y, engine: !target }; this.pointers.set(id, pointer); target?.focus({ preventScroll: true }); this.emitPointer(id, phase, pointer, false); return true;
  }
  click(ray: Pose): boolean {
    if (!this.panel) return false; const hit = panelHit(ray, this.panel, this.width, this.height); if (!hit) return false;
    const x = hit.u * this.layout.width, y = hit.v * this.layout.height;
    const hitElement = this.captureDOM ? document.elementFromPoint(x, y) : null;
    let target = hitElement?.closest('button,input,select,textarea,a,[role="button"],[tabindex]') || null;
    if (!target) for (let node = hitElement; node && node !== document.body; node = node.parentElement) if (node instanceof HTMLElement && getComputedStyle(node).cursor === 'pointer') { target = node; break; }
    if (!(target instanceof HTMLElement)) { const alpha = this.hitCanvas.getContext('2d', { willReadFrequently: true })?.getImageData(Math.min(191, Math.floor(hit.u * 192)), Math.min(107, Math.floor(hit.v * 108)), 1, 1).data[3] || 0; if (alpha > 10) { this.engineClick(x, y); return true; } return false; }
    target.focus({ preventScroll: true }); for (const name of ['pointermove', 'pointerdown', 'pointerup']) target.dispatchEvent(new PointerEvent(name, { clientX: x, clientY: y, pointerId: 100, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true, button: 0, buttons: name === 'pointerdown' ? 1 : 0 })); target.click(); this.dirty = true; return true;
  }
  destroy(): void { this.releasePointers(); this.stopped = true; this.gl.deleteTexture(this.controlsTexture); this.observer.disconnect(); document.removeEventListener('input', this.invalidate, true); window.removeEventListener('resize', this.invalidate); document.removeEventListener('visibilitychange', this.invalidate); this.engineBitmap?.close(); this.gl.deleteTexture(this.engineTexture); this.gl.deleteTexture(this.texture); this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); }
}
