import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/editor-extension', { recursive: true }); await copyFile('editor-extension/manifest.json', 'dist/editor-extension/manifest.json');
await build({ entryPoints: ['src/features/editor-tabletop.ts'], outfile: 'dist/editor-extension/editor.js', bundle: true, format: 'iife', target: 'es2022', minify: true });
console.info('Optional editor extension: dist/editor-extension');
