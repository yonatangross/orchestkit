#!/usr/bin/env node
/**
 * esbuild configuration for OrchestKit MCP servers
 *
 * Bundles all dependencies into single ESM files for stdio transport:
 *  - dist/server.mjs       — ork-elicit (setup-wizard form elicitation)
 *  - dist/docs-server.mjs  — orchestkit-docs (docs search + Markdown fetch)
 */

import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('./dist', { recursive: true });

const shared = {
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  minify: true,
  sourcemap: true,
  external: [],
};

await build({
  ...shared,
  entryPoints: ['./src/index.ts'],
  outfile: './dist/server.mjs',
  banner: { js: `// OrchestKit MCP Server — ork-elicit` },
});

await build({
  ...shared,
  entryPoints: ['./src/docs-server.ts'],
  outfile: './dist/docs-server.mjs',
  banner: { js: `// OrchestKit MCP Server — orchestkit-docs` },
});

console.log('Built dist/server.mjs and dist/docs-server.mjs');
