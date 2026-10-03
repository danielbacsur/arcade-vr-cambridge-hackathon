import { describe, expect, it } from 'vitest';
import { mapURL } from '../src/client/navigation.js';
import { resolveRouting } from '../src/server/routing.js';
const boot = resolveRouting('runtime.joinarcade.localhost:8765')?.boot; if (!boot) throw Error();
describe('injected network mapping', () => {
  it('uses the document base for relative texture and worker paths', () => { expect(mapURL('textures/skyboxes/day/px.png', boot, 'http://runtime.joinarcade.localhost:8765/')).toBe('http://runtime.joinarcade.localhost:8765/textures/skyboxes/day/px.png'); });
  it('maps socket endpoints and retains signed URL bytes', () => { expect(mapURL('wss://multiplayer.joinarcade.ai/p/room?token=a%2B', boot, 'http://runtime.localhost/')).toBe('ws://runtime.joinarcade.localhost:8765/__arcade_ws/multiplayer/p/room?token=a%2B'); expect(mapURL('https://storage.googleapis.com/b/file?sig=%2B%2F', boot, 'http://runtime.localhost/')).toBe('http://storage.joinarcade.localhost:8765/b/file?sig=%2B%2F'); });
});
