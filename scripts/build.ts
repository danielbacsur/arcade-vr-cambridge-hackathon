import { build } from 'esbuild';
import { resolve } from 'node:path';
import { cp, mkdir, rm, readdir } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/public/__arcade_vr', { recursive: true });
await cp('public', 'dist/public', { recursive: true });
const featureFiles = await readdir('src/features').catch((): string[] => []);
for (const entry of ['controller', 'runtime', 'navigation']) {
  const imports = featureFiles.filter(file => file.endsWith('.ts') && (entry === 'navigation' ? file.startsWith('editor-') : entry === 'runtime' && !file.startsWith('editor-'))).sort().map(file => `import ${JSON.stringify('../features/' + file)};`).join('\n');
  await build({ stdin: { contents: imports + `\nimport './${entry}.ts';`, resolveDir: resolve('src/client'), sourcefile: entry + '-entry.ts' }, outfile: `dist/public/__arcade_vr/${entry}.js`, bundle: true, format: 'iife', target: 'es2022', minify: true, sourcemap: true });
}
await build({ entryPoints: ['src/server/dev.ts'], outfile: 'dist/server/dev.js', bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', sourcemap: true });
console.log('Built browser adapters and TypeScript server.');
