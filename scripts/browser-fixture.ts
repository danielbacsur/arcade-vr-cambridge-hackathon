import { build } from 'esbuild';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
await mkdir('work/browser-fixture', { recursive: true }); await copyFile('tests/browser/ui.html', 'work/browser-fixture/ui.html');
await build({ entryPoints: ['tests/browser/ui.ts'], outfile: 'work/browser-fixture/ui.js', bundle: true, format: 'iife', platform: 'browser', target: 'es2022', external: ['node:worker_threads'] });
createServer((request, response) => { if (/^\/libs\/(glslang|twgsl)\.(js|wasm)$/.test(request.url || '')) { void fetch('https://editor.joinarcade.ai' + request.url, { signal: AbortSignal.timeout(30000) }).then(async upstream => { response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream'); response.writeHead(upstream.status); const bytes = Buffer.from(await upstream.arrayBuffer());
      // Arcade serves a UMD compiler; this fixture SDK expects an ESM default factory.
      response.end(request.url === '/libs/glslang.js' ? Buffer.concat([bytes, Buffer.from('\nexport default () => globalThis.glslang(new URL("glslang.wasm", import.meta.url).href);')]) : bytes); }).catch(() => { response.writeHead(502); response.end(); }); return; } const file = request.url === '/ui.js' ? 'ui.js' : 'ui.html'; void readFile('work/browser-fixture/' + file).then(data => { response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html'); response.end(data); }); }).listen(8766, '127.0.0.1', () => console.info('Browser fixture: http://127.0.0.1:8766'));
