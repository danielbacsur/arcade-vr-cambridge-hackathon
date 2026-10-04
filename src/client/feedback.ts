export interface HapticOutput { pulse?(strength: number, duration: number): Promise<unknown>; playEffect?(type: 'dual-rumble', parameters: { duration: number; strongMagnitude: number; weakMagnitude: number }): Promise<unknown> }
export class Feedback {
  private readonly last = new WeakMap<HapticOutput, number>();
  private readonly busy = new WeakSet<HapticOutput>();
  pulse(output: HapticOutput | undefined, time: number): void {
    if (!output || this.busy.has(output) || time - (this.last.get(output) ?? -Infinity) < 100) return;
    this.last.set(output, time); this.busy.add(output);
    try { const result = output.pulse?.(.25, 25) ?? output.playEffect?.('dual-rumble', { duration: 25, strongMagnitude: .25, weakMagnitude: .1 }); void Promise.resolve(result).catch(() => {}).finally(() => this.busy.delete(output)); } catch { this.busy.delete(output); }
  }
}
export class InteractionPulse {
  private until = 0;
  select(uiHandled: boolean, time: number): void { if (!uiHandled) this.until = time + 80; }
  keys(time: number): string[] { return time < this.until ? ['KeyE'] : []; }
  clear(): void { this.until = 0; }
}
