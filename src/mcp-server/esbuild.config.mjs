#!/usr/bin/env node
/**
 * esbuild configuration for OrchestKit MCP server
 *
 * Bundles all dependencies into a single ESM file for stdio transport.
 */

import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('./dist', { recursive: true });

await build({
  entryPoints: ['./src/index.ts'],
  outfile: './dist/server.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  minify: true,
  sourcemap: true,
  external: [],
  banner: {
    js: `// OrchestKit MCP Server — ork-elicit
// Generated: ${new Date().toISOString()}
`,
  },
});

console.log('Built dist/server.mjs');
