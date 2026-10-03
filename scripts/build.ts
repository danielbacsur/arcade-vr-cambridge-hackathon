import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/public/__arcade_vr', { recursive: true });
await cp('public', 'dist/public', { recursive: true });
await build({ entryPoints: ['src/client/controller.ts', 'src/client/runtime.ts', 'src/client/navigation.ts'], outdir: 'dist/public/__arcade_vr', bundle: true, format: 'iife', target: 'es2022', minify: true, sourcemap: true });
await build({ entryPoints: ['src/server/dev.ts'], outfile: 'dist/server/dev.js', bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', sourcemap: true });
console.log('Built browser adapters and TypeScript server.');
