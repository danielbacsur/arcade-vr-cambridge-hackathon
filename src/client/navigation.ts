import type { ProxyBoot } from '../shared/protocol.js';
import './globals.js';
export function mapURL(value: string | URL, boot: ProxyBoot, base = location.href): string {
  const url = new URL(String(value), base);
  const origin = boot.origins[url.hostname];
  if (origin && ['http:', 'https:'].includes(url.protocol)) return origin + url.pathname + url.search + url.hash;
  return url.href;
}
export function installNavigation(boot: ProxyBoot): void {
  const map = (value: string | URL) => mapURL(value, boot);
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (input instanceof Request) { const url = map(input.url); return originalFetch(url === input.url ? input : new Request(url, input), init); }
    return originalFetch(map(input), init);
  };
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
