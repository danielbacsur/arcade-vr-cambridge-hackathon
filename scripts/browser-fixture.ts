import { build } from 'esbuild';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
await mkdir('work/browser-fixture', { recursive: true }); await copyFile('tests/browser/ui.html', 'work/browser-fixture/ui.html');
await build({ entryPoints: ['tests/browser/ui.ts'], outfile: 'work/browser-fixture/ui.js', bundle: true, format: 'iife', platform: 'browser', target: 'es2022', external: ['node:worker_threads'] });
createServer((request, response) => { const file = request.url === '/ui.js' ? 'ui.js' : 'ui.html'; void readFile('work/browser-fixture/' + file).then(data => { response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html'); response.end(data); }); }).listen(8766, '127.0.0.1', () => console.info('Browser fixture: http://127.0.0.1:8766'));
