/** Only foreground XR time counts toward a stalled capture. */
export class FrameWatchdog {
  private last = 0;
  reset(time: number): void { this.last = time; }
  stalled(time: number, visible: boolean): boolean { if (!visible) { this.reset(time); return false; } return this.last > 0 && time - this.last > 6000; }
}
