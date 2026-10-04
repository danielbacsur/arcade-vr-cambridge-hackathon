/** Snap once per stick deflection; re-arm only after returning to center. */
export class SnapTurn {
  private armed = true;
  update(axis: number): number {
    if (!Number.isFinite(axis)) return 0;
    if (Math.abs(axis) < .25) this.armed = true;
    if (!this.armed || Math.abs(axis) < .7) return 0;
    this.armed = false; return axis > 0 ? -30 : 30;
  }
}
export function comfortVignette(speed: number): number { return Math.max(0, Math.min(.55, Math.abs(speed) * .55)); }
