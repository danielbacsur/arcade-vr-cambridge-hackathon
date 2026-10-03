import type { ProxyBoot } from '../shared/protocol.js';
import './globals.js';
import { recoverExpiredServer } from './recovery.js';
export function mapURL(value: string | URL, boot: ProxyBoot, base = document.baseURI): string {
  const url = new URL(String(value), base);
  const socket = ['ws:', 'wss:'].includes(url.protocol);
  const origin = socket ? boot.websocketOrigins?.[url.hostname] : boot.origins[url.hostname];
  if (origin && ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return origin + url.pathname + url.search + url.hash;
  return url.href;
}
export function installNavigation(boot: ProxyBoot): void {
  const map = (value: string | URL) => mapURL(value, boot);
  if (new URL(location.href).searchParams.has('diagnostic')) {
    const bitmap = window.createImageBitmap.bind(window);
    window.createImageBitmap = new Proxy(bitmap, { apply(target, receiver, argumentsList: unknown[]) {
      const source = argumentsList[0];
      const metadata = source instanceof Blob ? { type: source.type, bytes: source.size } : source instanceof HTMLImageElement ? { host: new URL(source.src, location.href).hostname, complete: source.complete, width: source.naturalWidth } : source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas ? { width: source.width, height: source.height } : { type: Object.prototype.toString.call(source) };
      return Reflect.apply(target, receiver, argumentsList).catch((error: unknown) => { console.error('[Arcade bitmap]', JSON.stringify(metadata), error); throw error; });
    } });
  }
  const originalFetch = window.fetch.bind(window);
  if (new URL(location.href).searchParams.has('diagnostic')) { const blob = Response.prototype.blob; Response.prototype.blob = async function() { const value = await blob.call(this); if (value.type.includes('text/html')) console.error('[Arcade image URL]', new URL(this.url || location.href).hostname, new URL(this.url || location.href).pathname); return value; }; }
  let recovering = false;
  const inspect = async (response: Response): Promise<Response> => {
    if (!recovering && response.status === 404 && new URL(response.url, location.href).pathname.endsWith('/multiplayer/join-reservations')) {
      recovering = true;
      try {
        const next = await recoverExpiredServer(new URL(location.href), boot, async url => { const result = await originalFetch(url); return result.ok ? result.json() : null; });
        if (next) { const notice = document.createElement('div'); notice.setAttribute('role', 'status'); notice.textContent = 'This server expired. Joining a fresh game…'; document.body.append(notice); location.replace(next.href); }
      } catch { /* Preserve Arcade's error when catalog recovery is unavailable. */ }
    }
    return response;
  };
  window.fetch = (input, init) => {
    if (input instanceof Request) { const url = map(input.url); return originalFetch(url === input.url ? input : new Request(url, input), init).then(inspect); }
    return originalFetch(map(input), init).then(inspect);
  };
  const Socket = window.WebSocket;
  window.WebSocket = new Proxy(Socket, { construct(target, argumentsList: [string | URL, (string | string[])?]) {
    const [url, protocols] = argumentsList; return protocols === undefined ? new target(map(url)) : new target(map(url), protocols);
  } });
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async: boolean = true, username?: string | null, password?: string | null): void { open.call(this, method, map(url), async, username, password); };
  const openWindow = window.open.bind(window);
  window.open = (url, target, features) => {
    const popup = openWindow(url ? map(url) : url, target, features); if (!popup) return popup;
    const proxiedLocation = new Proxy(popup.location, {
      get(object, key) { if (key === 'assign' || key === 'replace') return (next: string) => object[key](map(next)); const value: unknown = Reflect.get(object, key, object); return typeof value === 'function' ? value.bind(object) : value; },
      set(object, key, value: unknown) { return Reflect.set(object, key, key === 'href' ? map(String(value)) : value, object); },
    });
    return new Proxy(popup, { get(object, key) { if (key === 'location') return proxiedLocation; const value: unknown = Reflect.get(object, key, object); return typeof value === 'function' ? value.bind(object) : value; }, set(object, key, value: unknown) { if (key === 'location') { object.location.href = map(String(value)); return true; } return Reflect.set(object, key, value, object); } });
  };
  document.addEventListener('click', event => { if (event.target instanceof Element) { const anchor = event.target.closest<HTMLAnchorElement>('a[href]'); if (anchor) anchor.href = map(anchor.href); } }, true);
  const scan = () => { for (const frame of document.querySelectorAll<HTMLIFrameElement>('iframe[src]')) { const mapped = map(frame.src); if (mapped !== frame.src) { frame.allow = [frame.allow, 'xr-spatial-tracking', 'gamepad', 'fullscreen'].filter(Boolean).join('; '); frame.src = mapped; } } };
  const observe = () => { scan(); new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true }); else observe();
}
if (typeof window !== 'undefined' && window.ARCADE_PROXY) installNavigation(window.ARCADE_PROXY);
