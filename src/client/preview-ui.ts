import { toCanvas } from 'html-to-image';
/** Cached original DOM UI, composited with engine HUD onto both desktop eyes. */
export class PreviewUI {
  private readonly observer: MutationObserver;
  private dirty = true;
  private busy = false;
  private stopped = false;
  private last = 0;
  private dom?: HTMLCanvasElement;
  private hud?: ImageBitmap;
  private readonly output = new OffscreenCanvas(1, 1);
  constructor() { this.observer = new MutationObserver(() => { this.dirty = true; }); this.observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); document.addEventListener('input', this.invalidate, true); }
  private invalidate = (): void => { this.dirty = true; };
  setHUD(bitmap: ImageBitmap): void { this.hud?.close(); this.hud = bitmap; }
  async compose(bitmap: ImageBitmap): Promise<ImageBitmap> {
    if (this.stopped) return bitmap;
    const now = performance.now();
    if (this.dirty && !this.busy && now - this.last > 250) {
      this.busy = true; this.dirty = false; this.last = now;
      void toCanvas(document.body, { width: 1920, height: 1080, canvasWidth: 1920, canvasHeight: 1080, pixelRatio: 1, backgroundColor: 'transparent', skipFonts: true, filter: node => !(node instanceof HTMLCanvasElement), style: { background: 'transparent', width: '1920px', height: '1080px' } }).then(canvas => { if (!this.stopped) this.dom = canvas; }).catch(() => { this.dirty = true; }).finally(() => { this.busy = false; });
    }
    if (this.output.width !== bitmap.width || this.output.height !== bitmap.height) { this.output.width = bitmap.width; this.output.height = bitmap.height; }
    const context = this.output.getContext('2d', { alpha: false, colorSpace: 'srgb' }); if (!context) return bitmap;
    context.drawImage(bitmap, 0, 0);
    for (const x of [0, bitmap.width / 2]) { if (this.hud) context.drawImage(this.hud, x, 0, bitmap.width / 2, bitmap.height); if (this.dom) context.drawImage(this.dom, x, 0, bitmap.width / 2, bitmap.height); }
    try { return await createImageBitmap(this.output, { colorSpaceConversion: 'none' }); } finally { bitmap.close(); }
  }
  destroy(): void { this.stopped = true; this.observer.disconnect(); document.removeEventListener('input', this.invalidate, true); this.hud?.close(); this.hud = undefined; this.dom = undefined; }
}
