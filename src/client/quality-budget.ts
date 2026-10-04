/** Conservative capture scaling: fast reductions and slow quality recovery. */
export class QualityBudget {
  scale = .8;
  private measured = 0;
  private samples = 0;
  private changed = 0;
  sample(milliseconds: number, now: number): number {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return this.scale;
    this.measured = this.samples ? this.measured * .9 + milliseconds * .1 : milliseconds; this.samples++;
    if (this.samples < 20 || now - this.changed < (this.measured > 20 ? 1000 : 5000)) return this.scale;
    if (this.measured > 20) { this.scale = Math.max(.4, Math.round((this.scale - .1) * 100) / 100); this.changed = now; }
    else if (this.measured < 10 && this.scale < .8) { this.scale = Math.min(.8, Math.round((this.scale + .05) * 100) / 100); this.changed = now; }
    return this.scale;
  }
}
