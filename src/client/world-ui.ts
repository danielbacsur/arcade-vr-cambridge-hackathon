import { toCanvas } from 'html-to-image';
import type { Pose } from '../shared/protocol.js';
import { panelHit } from './ui-hit.js';
import { rotate } from './tracking.js';
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
  constructor(private readonly gl: WebGL2RenderingContext, private readonly onError: (message: string) => void, private readonly captureDOM = true, private readonly engineClick: (x: number, y: number) => void = () => {}, private readonly layout = { width: 1920, height: 1080 }) {
    this.width = Math.min(2.4, 1.5 * layout.width / layout.height); this.height = this.width * layout.height / layout.width;
    this.texture = gl.createTexture(); this.engineTexture = gl.createTexture(); this.hitCanvas.width = 192; this.hitCanvas.height = 108; this.buffer = gl.createBuffer();
    const shader = (kind: number, source: string) => { const value = gl.createShader(kind); if (!value) throw Error('UI shader unavailable'); gl.shaderSource(value, source); gl.compileShader(value); if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(value) || 'UI shader failed'); return value; };
    const vertex = shader(gl.VERTEX_SHADER, '#version 300 es\nin vec2 position;uniform mat4 projection;uniform mat4 view;uniform mat4 model;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=projection*view*model*vec4(position.x*1.2,position.y*.675,0.,1.);}');
    const fragment = shader(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;in vec2 uv;uniform sampler2D image;out vec4 color;void main(){color=texture(image,vec2(uv.x,1.-uv.y));}');
    const program = gl.createProgram(); if (!program) throw Error('UI program unavailable'); this.program = program; gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program) || 'UI link failed');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.observer = new MutationObserver(() => { this.dirty = true; }); this.observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    document.addEventListener('input', this.invalidate, true);
  }
  setEngineBitmap(bitmap: ImageBitmap): void { this.engineBitmap?.close(); this.engineBitmap = bitmap; this.engineUpdated = true; const context = this.hitCanvas.getContext('2d', { willReadFrequently: true }); context?.clearRect(0, 0, 192, 108); context?.drawImage(bitmap, 0, 0, 192, 108); }
  private invalidate = (): void => { this.dirty = true; };
  anchor(head: Pose): void { const forward = rotate(head.orientation, { x: 0, y: 0, z: -1 }), yaw = Math.atan2(-forward.x, -forward.z) / 2; this.panel = { position: { x: head.position.x + Math.sin(yaw * 2) * -2, y: head.position.y - .1, z: head.position.z - Math.cos(yaw * 2) * 2 }, orientation: { x: 0, y: Math.sin(yaw), z: 0, w: Math.cos(yaw) } }; }
  update(time: number): void { if (!this.captureDOM || this.stopped || this.busy || !this.dirty || time - this.captured < 250) return; this.busy = true; this.dirty = false; this.captured = time;
    void toCanvas(document.body, { width: this.layout.width, height: this.layout.height, canvasWidth: 1920, canvasHeight: 1080, pixelRatio: 1, backgroundColor: 'transparent', skipFonts: true, filter: node => !(node instanceof HTMLCanvasElement && node.dataset.arcadeVrEngine === 'true'), style: { background: 'transparent', width: this.layout.width + 'px', height: this.layout.height + 'px' } }).then(canvas => { if (!this.stopped) { this.canvas = canvas; this.updated = true; } }).catch(() => { this.onError('Some game UI could not be captured. DOM overlays remain the preferred path.'); }).finally(() => { this.busy = false; });
  }
  draw(projection: Float32Array, view: Float32Array, head: Pose): void {
    const pc = window.pc, gl = this.gl; if ((!this.canvas && !this.engineBitmap) || !pc) return; if (!this.panel) this.anchor(head);
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
    gl.disable(gl.BLEND);
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
  destroy(): void { this.stopped = true; this.observer.disconnect(); document.removeEventListener('input', this.invalidate, true); this.engineBitmap?.close(); this.gl.deleteTexture(this.engineTexture); this.gl.deleteTexture(this.texture); this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); }
}
