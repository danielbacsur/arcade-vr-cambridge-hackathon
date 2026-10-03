import { describe, expect, it } from 'vitest';
import { assetTarget, isGameRoute, resolveRouting, rewriteOrigins, websocketTarget } from '../src/server/routing.js';
describe('fixed upstream routing', () => {
  it.each(['editor.joinarcade.localhost:8765', 'editor.localhost:8765', 'editor.joinarcade.danielbacsur.dev'])('recognizes editor host %s', host => { expect(resolveRouting(host)?.role).toBe('editor'); });
  it('rejects unknown and misleading hosts', () => { for (const host of ['evil.com', 'editor.joinarcade.danielbacsur.dev.evil.com', '127.0.0.2', 'runtime.evil.localhost']) expect(resolveRouting(host)).toBeNull(); });
  it('keeps runtime fetches inside the engine realm', () => { const r = resolveRouting('runtime.joinarcade.localhost:8765'); expect(r?.boot.origins['editor.joinarcade.ai']).toBe('http://runtime.joinarcade.localhost:8765'); });
  it.each(['/mp', '/mp/', '/play/b64642d7-d51d-458c-8a5f-108ca45431b2'])('wraps the game route %s', path => expect(isGameRoute(path)).toBe(true));
  it('does not wrap editing and API paths', () => { for (const path of ['/editor/abc', '/play/abc/source', '/games/abc', '/mp/evil']) expect(isGameRoute(path)).toBe(false); });
  it('preserves signed URL path and query bytes', () => { const r = resolveRouting('editor.joinarcade.localhost:8765'); if (!r) throw Error(); expect(rewriteOrigins('https://storage.googleapis.com/a/b%20c?sig=abc%2B%2F&x=1', r)).toBe('http://storage.joinarcade.localhost:8765/a/b%20c?sig=abc%2B%2F&x=1'); });
  it('rewrites escaped URLs without changing arbitrary text', () => { const r = resolveRouting('editor.joinarcade.localhost:8765'); if (!r) throw Error(); expect(rewriteOrigins('https:\\/\\/editor.joinarcade.ai\\/mp', r)).toBe('http:\\/\\/editor.joinarcade.localhost:8765\\/mp'); });
  it('limits asset and socket targets to an explicit registry', () => { expect(assetTarget('/__arcade_asset/jsdelivr/a?sig=x')?.host).toBe('cdn.jsdelivr.net'); expect(assetTarget('/__arcade_asset/evil/a')).toBeNull(); expect(websocketTarget('/__arcade_ws/api/socket?a=b')?.href).toBe('wss://arcade-ai-api-700875384378.europe-west1.run.app/socket?a=b'); expect(websocketTarget('/__arcade_ws/localhost/')).toBeNull(); });
});
