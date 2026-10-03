import { describe, expect, it } from 'vitest';
import { quickMatchURL, recoverExpiredServer } from '../src/client/recovery.js';
import { resolveRouting } from '../src/server/routing.js';
const boot = resolveRouting('runtime.localhost:8765')?.boot; if (!boot) throw Error();
describe('expired multiplayer links', () => {
  const id = '0c902e35-c4f6-4c04-9dbe-97dc04e69c4f';
  it('uses the public catalog game, preserves return path and prevents loops', async () => {
    const url = new URL('http://runtime.localhost:8765/mp?serverId=expired&marketplaceReturnTo=' + encodeURIComponent('http://localhost:8765/games/test'));
    const recovered = await recoverExpiredServer(url, boot, async () => ({ gameId: id })); expect(recovered?.searchParams.get('gameId')).toBe(id); expect(recovered?.searchParams.has('serverId')).toBe(false); expect(recovered?.searchParams.get('marketplaceReturnTo')).toBe(url.searchParams.get('marketplaceReturnTo'));
    if (!recovered) throw Error(); expect(await recoverExpiredServer(recovered, boot, async () => { throw Error('No repeat'); })).toBeNull();
  });
  it('refuses unrelated return hosts and invalid game IDs', async () => { expect(await recoverExpiredServer(new URL('http://runtime.localhost:8765/mp?serverId=x&marketplaceReturnTo=https://evil.com/games/a'), boot, async () => { throw Error(); })).toBeNull(); expect(quickMatchURL(new URL('http://runtime.localhost/mp?serverId=x'), 'invalid')).toBeNull(); });
});
