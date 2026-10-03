import { isRecord, type ProxyBoot } from '../shared/protocol.js';
export function quickMatchURL(current: URL, gameId: string): URL | null {
  if (current.pathname !== '/mp' || !current.searchParams.has('serverId') || !/^[a-f0-9-]{36}$/i.test(gameId)) return null;
  const next = new URL(current); next.searchParams.delete('serverId'); next.searchParams.delete('invitationToken'); next.searchParams.delete('gameRunId'); next.searchParams.set('gameId', gameId); next.searchParams.set('recoveredServer', '1'); return next;
}
export async function recoverExpiredServer(current: URL, boot: ProxyBoot, read: (url: string) => Promise<unknown>): Promise<URL | null> {
  if (current.pathname !== '/mp' || !current.searchParams.has('serverId') || current.searchParams.has('recoveredServer')) return null;
  const returnTo = current.searchParams.get('marketplaceReturnTo'); if (!returnTo) return null;
  let slug: string; try { const url = new URL(returnTo); if (![...Object.values(boot.origins).map(value => new URL(value).origin), 'https://www.tryarcade.com'].includes(url.origin)) return null; const match = /^\/games\/([^/]+)$/.exec(url.pathname); if (!match?.[1]) return null; slug = decodeURIComponent(match[1]); } catch { return null; }
  const api = boot.origins['arcade-ai-api-700875384378.europe-west1.run.app']; if (!api) return null;
  const game = await read(api + '/marketplace/games/' + encodeURIComponent(slug));
  const info = isRecord(game) && isRecord(game.data) ? game.data : game;
  return isRecord(info) && typeof info.gameId === 'string' ? quickMatchURL(current, info.gameId) : null;
}
