import type { ProxyBoot } from '../shared/protocol.js';
export const UPSTREAMS = {
  multiplayer: 'multiplayer.joinarcade.ai', supabase: 'ivsqhfqkvqrnvpatoorf.supabase.co', site: 'www.tryarcade.com', editor: 'editor.joinarcade.ai', dashboard: 'dashboard.joinarcade.ai',
  api: 'arcade-ai-api-700875384378.europe-west1.run.app', storage: 'storage.googleapis.com',
  apiLegacy: 'arcade-ai-api-vud7pmmljq-ew.a.run.app', fonts: 'fonts.googleapis.com', fontFiles: 'fonts.gstatic.com',
  jsdelivr: 'cdn.jsdelivr.net', unpkg: 'unpkg.com', firebase: 'www.googleapis.com', identity: 'identitytoolkit.googleapis.com',
  tokens: 'securetoken.googleapis.com', firestore: 'firestore.googleapis.com', about: 'about.tryarcade.com',
} as const;
export type Role = 'site' | 'editor' | 'runtime' | 'dashboard' | 'api' | 'storage';
export interface Routing { authority: string; role: Role; upstream: string; local: boolean; scheme: 'http' | 'https'; boot: ProxyBoot }
const roleHosts: Record<Role, string> = { site: 'www.tryarcade', editor: 'editor.joinarcade', runtime: 'runtime.joinarcade', dashboard: 'dashboard.joinarcade', api: 'api.joinarcade', storage: 'storage.joinarcade' };
export function resolveRouting(authority: string, scheme: 'http' | 'https' = 'http', domain = process.env.ARCADE_DOMAIN || 'danielbacsur.dev'): Routing | null {
  let url: URL; try { url = new URL(`${scheme}://${authority}`); } catch { return null; }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.localhost');
  const aliases: Record<string, Role> = { localhost: 'site', '127.0.0.1': 'site', 'site.localhost': 'site', 'editor.localhost': 'editor', 'runtime.localhost': 'runtime' };
  let role: Role | undefined = aliases[url.hostname];
  for (const [key, prefix] of Object.entries(roleHosts) as [Role, string][]) if (url.hostname === `${prefix}.${local ? 'localhost' : domain}`) role = key;
  if (!role && [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].includes(url.hostname)) role = 'site';
  if (!role) return null;
  const port = url.port ? `:${url.port}` : '';
  const shortEditor = local && ['editor.localhost', 'runtime.localhost'].includes(url.hostname);
  const origin = (r: Role) => `${scheme}://${local && r === 'site' ? 'localhost' : shortEditor && ['editor', 'runtime'].includes(r) ? r + '.localhost' : roleHosts[r] + '.' + (local ? 'localhost' : domain)}${port}`;
  const origins: Record<string, string> = {};
  for (const [key, host] of Object.entries(UPSTREAMS)) {
    if (['site', 'editor', 'dashboard', 'api', 'storage'].includes(key)) origins[host] = origin(key as Role);
    else if (key === 'apiLegacy') origins[host] = origin('api');
    else origins[host] = origin('runtime') + '/__arcade_asset/' + key;
  }
  if (role === 'runtime') origins[UPSTREAMS.editor] = url.origin;
  return { authority, role, upstream: role === 'runtime' ? UPSTREAMS.editor : UPSTREAMS[role], local, scheme, boot: { origins, runtime: origin('runtime'), wrapper: origin('editor'), role, websocketProxy: true, websocketOrigins: Object.fromEntries(Object.entries(UPSTREAMS).map(([key, host]) => [host, origin('runtime').replace(/^http/, 'ws') + '/__arcade_ws/' + key])) } };
}
export function rewriteOrigins(text: string, routing: Routing, reverse = false): string {
  const pairs = [...Object.entries(routing.boot.origins).map(([host, origin]) => [host, origin, 'https'] as const), ...Object.entries(routing.boot.websocketOrigins || {}).map(([host, origin]) => [host, origin, 'wss'] as const)].flatMap(([host, origin, protocol]) => {
    const from = reverse ? origin : `${protocol}://${host}`, to = reverse ? `${protocol}://${host}` : origin;
    return [[from, to], [from.replaceAll('/', '\\/'), to.replaceAll('/', '\\/')]];
  });
  pairs.sort((a, b) => (b[0]?.length || 0) - (a[0]?.length || 0));
  const replacements = new Map(pairs as [string, string][]);
  const pattern = [...replacements.keys()].map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  text = text.replace(new RegExp(pattern, 'g'), match => replacements.get(match) || match);
  return text;
}
export function isGameRoute(path: string): boolean { return /^\/play\/[a-f0-9-]{36}\/?$/i.test(path) || /^\/mp\/?$/.test(path); }
export function assetTarget(path: string): { host: string; path: string } | null {
  const match = /^\/__arcade_asset\/([a-zA-Z]+)(\/.*|$)/.exec(path);
  const key = match?.[1]; if (!key || !(key in UPSTREAMS)) return null;
  return { host: UPSTREAMS[key as keyof typeof UPSTREAMS], path: match?.[2] || '/' };
}
export function websocketTarget(path: string): URL | null {
  const match = /^\/__arcade_ws\/([^/]+)(\/.*|$)/.exec(path);
  const key = match?.[1]; if (!key || !(key in UPSTREAMS)) return null;
  return new URL(`wss://${UPSTREAMS[key as keyof typeof UPSTREAMS]}${match?.[2] || '/'}`);
}
