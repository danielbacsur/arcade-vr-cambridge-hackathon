/** Bounded render scaling with slow recovery and a five-second cooldown. */
export class QualityBudget {
  scale = 1;
  private measured = 0;
  private samples = 0;
  private changed = 0;
  sample(milliseconds: number, now: number): number {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return this.scale;
    this.measured = this.samples ? this.measured * .9 + milliseconds * .1 : milliseconds; this.samples++;
    if (this.samples < 20 || now - this.changed < 5000) return this.scale;
    if (this.measured > 20) { this.scale = Math.max(.6, Math.round((this.scale - .1) * 100) / 100); this.changed = now; }
    else if (this.measured < 10 && this.scale < 1) { this.scale = Math.min(1, Math.round((this.scale + .05) * 100) / 100); this.changed = now; }
    return this.scale;
  }
}
