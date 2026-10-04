import { createHash } from 'node:crypto';
import { coverageSummary, type CoverageResult } from './coverage-result.js';
import { request } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { isRecord } from '../src/shared/protocol.js';
import { resolveRouting, UPSTREAMS } from '../src/server/routing.js';
const port = Number(process.env.PORT || 8765), api = `https://${UPSTREAMS.api}`, routing = resolveRouting(`runtime.joinarcade.localhost:${port}`);
if (!routing) throw Error('Missing routing');
const results: CoverageResult[] = [];
async function local(url: string, method = 'GET', range?: string): Promise<Response> {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = request(`http://127.0.0.1:${port}${parsed.pathname}${parsed.search}`, { method, headers: { host: parsed.host, ...(range ? { range } : {}) } }, incoming => {
      const chunks: Buffer[] = []; incoming.on('data', chunk => chunks.push(Buffer.from(chunk)));
      incoming.on('end', () => resolve(new Response(method === 'HEAD' || [204, 304].includes(incoming.statusCode || 0) ? null : Buffer.concat(chunks), { status: incoming.statusCode, headers: Object.fromEntries(Object.entries(incoming.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) })));
    }); req.setTimeout(45000, () => req.destroy(Error('Timeout'))); req.on('error', reject); req.end();
  });
}
async function pool<T>(items: T[], callback: (item: T) => Promise<void>): Promise<void> { let index = 0; await Promise.all(Array.from({ length: 4 }, async () => { while (index < items.length) { const item = items[index++]; if (item !== undefined) await callback(item); } })); }
const json = async (url: string): Promise<unknown> => { const response = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (!response.ok) throw Error(`HTTP ${response.status}`); return response.json(); };
const catalog: Record<string, unknown>[] = [];
for (let skip = 0; ; skip += 50) { const page = await json(`${api}/marketplace/games?take=50&skip=${skip}`); if (!isRecord(page) || !Array.isArray(page.data)) throw Error('Unexpected catalog schema'); catalog.push(...page.data.filter(isRecord)); if (page.data.length < 50 || catalog.length >= Number(page.total)) break; }
console.info(`Checking ${catalog.length} public games with four workers. Signed URLs are not saved.`);
await pool(catalog, async game => {
  const name = String(game.name), slug = String(game.slug);
  try {
    const play = await json(`${api}/marketplace/games/${encodeURIComponent(slug)}/play-url`);
    if (isRecord(play) && typeof play.url === 'string') {
      const url = new URL(play.url, `https://${UPSTREAMS.editor}`), original = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const proxy = await local(`http://runtime.joinarcade.localhost:${port}${url.pathname}${url.search}`), html = await proxy.text();
      results.push({ kind: 'play bootstrap', name, upstream: original.status, proxy: proxy.status, detail: html.includes('/__arcade_vr/runtime.js') ? 'adapter injected; gameplay unverified' : 'adapter missing' }); await original.body?.cancel();
    }
  } catch (error) { results.push({ kind: 'play bootstrap', name, upstream: 0, proxy: 0, detail: error instanceof Error ? error.message : 'network failure' }); }
  for (const key of ['thumbnailUrl', 'vignetteUrl']) {
    const value = game[key]; if (typeof value !== 'string') continue;
    try {
      const url = new URL(value), proxyOrigin = routing.boot.origins[url.hostname]; if (!proxyOrigin) { results.push({ kind: key, name, upstream: 0, proxy: 0, detail: 'unmapped asset host: ' + url.hostname }); continue; }
      const original = await fetch(value, { headers: { range: 'bytes=0-65535' }, signal: AbortSignal.timeout(30000) }), proxy = await local(proxyOrigin + url.pathname + url.search, 'GET', 'bytes=0-65535');
      const a = Buffer.from(await original.arrayBuffer()), b = Buffer.from(await proxy.arrayBuffer());
      results.push({ kind: key, name, upstream: original.status, proxy: proxy.status, bytes: b.length, identical: createHash('sha256').update(a).digest('hex') === createHash('sha256').update(b).digest('hex') });
    } catch (error) { results.push({ kind: key, name, upstream: 0, proxy: 0, detail: error instanceof Error ? error.message : 'network failure' }); }
  }
});
for (const path of ['/libs/glslang.js', '/libs/glslang.wasm', '/libs/twgsl.js', '/libs/twgsl.wasm', ...['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(face => '/textures/skyboxes/day/' + face + '.png')]) {
  try {
  const original = await fetch(`https://${UPSTREAMS.editor}${path}`, { signal: AbortSignal.timeout(30000) }), proxy = await local(`http://runtime.joinarcade.localhost:${port}${path}`);
  results.push({ kind: 'engine dependency', name: path, upstream: original.status, proxy: proxy.status, identical: Buffer.from(await original.arrayBuffer()).equals(Buffer.from(await proxy.arrayBuffer())) });
  } catch (error) { results.push({ kind: 'engine dependency', name: path, upstream: 0, proxy: 0, detail: error instanceof Error ? error.message : 'network failure' }); }
}
await mkdir('work', { recursive: true }); const report = { time: new Date().toISOString(), games: catalog.length, results, summary: coverageSummary(results), boundary: 'HTTP/bootstrap and sampled bytes only; not all in-game assets or gameplay. No headset present.' };
await writeFile('work/compatibility.json', JSON.stringify(report, null, 2));
const summary = coverageSummary(results);
console.info(`${summary.checks} checks; ${summary.discrepancies} proxy discrepancies; ${summary.inconclusive} inconclusive; ${summary.upstreamFailures} upstream failures. Report: work/compatibility.json`);
if (!summary.passed) process.exitCode = 1;
