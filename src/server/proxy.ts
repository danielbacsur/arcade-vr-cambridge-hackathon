import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { assetTarget, isGameRoute, resolveRouting, rewriteOrigins, type Routing } from './routing.js';
export interface ProxyOptions { publicDirectory: string; fetch?: typeof fetch; domain?: string }
const forbidden = new Set(['host', 'connection', 'content-length', 'accept-encoding', 'if-none-match', 'if-modified-since', 'transfer-encoding', 'upgrade', 'proxy-authorization', 'authorization']);
const privateHeader = (name: string) => /^(x-vercel-|x-forwarded-|x-lab-)/.test(name);
const scriptJSON = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');
export function injectPage(html: string, routing: Routing, path: string): string {
  const boot = `<script>window.ARCADE_PROXY=${scriptJSON(routing.boot)};</script><script src="/__arcade_vr/navigation.js"></script>`;
  html = html.replace(/<head[^>]*>/i, match => match + boot);
  if (routing.role === 'runtime' && isGameRoute(path)) html = html.replace(/<\/body>/i, '<script src="/__arcade_vr/runtime.js"></script></body>');
  return html;
}
export function cookieForProxy(cookie: string, routing: Routing): string {
  cookie = cookie.replace(/;\s*Domain=[^;]+/gi, '');
  // JoinArcade session cookies need to reach editor and its isolated runtime.
  if (!routing.local && ['editor', 'runtime', 'dashboard', 'api'].includes(routing.role)) cookie += `; Domain=joinarcade.${process.env.ARCADE_DOMAIN || 'danielbacsur.dev'}`;
  return cookie;
}
export function upstreamHeaders(request: IncomingMessage, routing: Routing): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value || forbidden.has(key) || privateHeader(key)) continue;
    let text = Array.isArray(value) ? value.join(', ') : value;
    if (key === 'cookie') text = text.split(';').filter(pair => !/^\s*_{1,2}vercel/i.test(pair)).join(';');
    if (key === 'origin' || key === 'referer') {
      try { const url = new URL(text), context = resolveRouting(url.host, url.protocol === 'https:' ? 'https' : 'http'); if (context) text = `https://${context.upstream}${key === 'referer' ? url.pathname + url.search : ''}`; } catch { /* Keep a legitimate third-party origin unchanged. */ }
    } else text = rewriteOrigins(text, routing, true);
    headers.set(key, text);
  }
  // Bearer tokens are forwarded only to the fixed API/editor they were intended for.
  if (request.headers.authorization && ['api', 'editor', 'runtime', 'dashboard'].includes(routing.role)) headers.set('authorization', request.headers.authorization);
  headers.set('accept-encoding', 'identity'); return headers;
}
export function createProxy(options: ProxyOptions) {
  const fetcher = options.fetch || fetch;
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const scheme = request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const routing = resolveRouting(request.headers.host || '', scheme, options.domain);
    const json = (status: number, value: unknown) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
    if (!routing) { json(421, { error: 'unknown_proxy_host' }); return; }
    const rawPath = request.url || '/', url = new URL(rawPath, `${scheme}://${routing.authority}`), path = url.pathname;
    const cors = request.headers.origin;
    if (cors) { try { const origin = new URL(cors); if (resolveRouting(origin.host, origin.protocol === 'https:' ? 'https' : 'http', options.domain)) { response.setHeader('Access-Control-Allow-Origin', cors); response.setHeader('Access-Control-Allow-Credentials', 'true'); response.setHeader('Vary', 'Origin'); } } catch { /* Invalid origins are not reflected. */ } }
    if (path === '/__arcade_vr/health') { json(200, { ok: true, runtime: 'typescript', role: routing.role, multiplayer: true, websocket: 'fluid-compute-or-node' }); return; }
    const localFile = /^\/__arcade_vr\/(controller|runtime|navigation)\.js(?:\.map)?$/.test(path) || path === '/__arcade_vr/controller.css';
    if (localFile || (request.method === 'GET' || request.method === 'HEAD') && routing.role === 'editor' && isGameRoute(path)) {
      const file = localFile ? path.endsWith('controller.css') ? join(options.publicDirectory, 'controller.css') : join(options.publicDirectory, path) : join(options.publicDirectory, 'controller.html');
      try { const data = await readFile(file); response.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.map') ? 'application/json' : 'text/javascript', 'Cache-Control': 'no-store' }); response.end(request.method === 'HEAD' ? undefined : data); } catch { json(503, { error: 'build_required', action: 'Run npm run build before starting the proxy.' }); } return;
    }
    const asset = assetTarget(rawPath);
    if (path.startsWith('/__arcade_asset/') && !asset) { json(403, { error: 'unapproved_asset_host' }); return; }
    const upstream = `https://${asset?.host || routing.upstream}${asset?.path || rawPath}`;
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 45000);
    response.once('close', () => { if (!response.writableEnded) controller.abort(); });
    try {
      let body: Buffer | undefined;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method || 'GET')) {
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of request) { const buffer = Buffer.from(chunk as Uint8Array); size += buffer.byteLength; if (size > 8_000_000) { clearTimeout(timer); json(413, { error: 'request_too_large' }); return; } chunks.push(buffer); }
        body = Buffer.concat(chunks);
      }
      let result: Response | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { result = await fetcher(upstream, { method: request.method, headers: upstreamHeaders(request, routing), body: body ? new Uint8Array(body).buffer : undefined, redirect: 'manual', signal: controller.signal }); } catch (error) { if (attempt === 2 || !['GET', 'HEAD'].includes(request.method || 'GET') || controller.signal.aborted) throw error; }
        if (result && (result.status < 500 || attempt === 2 || request.method !== 'GET')) break;
        await result?.body?.cancel(); await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
      }
      clearTimeout(timer); if (!result) throw Error('No upstream response');
      const mime = result.headers.get('content-type') || 'application/octet-stream', stream = mime.includes('text/event-stream');
      const textual = !stream && /text\/|javascript|json|xml|wasm-js/.test(mime);
      for (const [key, value] of result.headers) {
        if (['content-length', 'content-encoding', 'transfer-encoding', 'connection', 'set-cookie', 'etag', 'content-md5', 'access-control-allow-origin', 'access-control-allow-credentials', 'x-frame-options', 'content-security-policy'].includes(key)) continue;
        response.setHeader(key, rewriteOrigins(value, routing));
      }
      const cookies = result.headers.getSetCookie(); if (cookies.length) response.setHeader('set-cookie', cookies.map(cookie => cookieForProxy(cookie, routing)));
      response.setHeader('Permissions-Policy', 'xr-spatial-tracking=(self "' + routing.boot.runtime + '"), gamepad=(self "' + routing.boot.runtime + '")');
      response.setHeader('Cache-Control', textual ? 'no-store' : result.headers.get('cache-control') || 'public, max-age=300');
      if (textual) {
        let text = rewriteOrigins(await result.text(), routing);
        if (mime.includes('text/html')) text = injectPage(text, routing, path);
        let data: Buffer = Buffer.from(text); if (data.byteLength > 100_000 && request.headers['accept-encoding']?.includes('gzip')) { data = gzipSync(data); response.setHeader('Content-Encoding', 'gzip'); response.setHeader('Vary', cors ? 'Origin, Accept-Encoding' : 'Accept-Encoding'); }
        response.setHeader('Content-Length', data.byteLength); response.writeHead(result.status); response.end(request.method === 'HEAD' ? undefined : data);
      } else {
        response.writeHead(result.status); if (request.method === 'HEAD' || !result.body) response.end(); else Readable.fromWeb(result.body as import('node:stream/web').ReadableStream).pipe(response);
      }
    } catch (error) { clearTimeout(timer); if (!response.headersSent) json(502, { error: 'upstream_unavailable', host: asset?.host || routing.upstream, detail: error instanceof Error ? error.name : 'NetworkError', retryable: true }); else response.destroy(); }
  };
}
