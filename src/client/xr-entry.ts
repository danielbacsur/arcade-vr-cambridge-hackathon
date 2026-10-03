export interface EntryEnvironment { supported(): boolean; ready(): boolean; active(): boolean; request(): Promise<void>; report(message: string): void }
/** Request synchronously inside the existing game interaction; never defer activation across a message. */
export class AutomaticEntry {
  private requesting = false;
  private denied = false;
  constructor(private readonly environment: EntryEnvironment) {}
  tryEnter(gesture: boolean): void {
    const e = this.environment;
    if (!e.supported() || !e.ready() || e.active() || this.requesting || this.denied) return;
    if (!gesture && !navigator.userActivation?.isActive) return;
    this.requesting = true;
    let result: Promise<void>;
    try { result = e.request(); } catch (error) { result = Promise.reject(error); }
    void result.catch(error => {
      const name = error instanceof Error ? error.name : '';
      this.denied = name === 'NotAllowedError';
      e.report(name === 'SecurityError' ? 'Use the game’s Start interaction to enter VR.' : error instanceof Error ? error.message : 'VR entry failed.');
    }).finally(() => { this.requesting = false; });
  }
}
