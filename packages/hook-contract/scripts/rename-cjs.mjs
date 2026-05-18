#!/usr/bin/env node
/**
 * Post-build: drop a `{"type":"commonjs"}` package.json into dist/cjs/ so
 * Node's resolver treats the CJS output as CJS even though the parent
 * package is `"type": "module"`. This is the canonical 2024+ dual-publish
 * pattern (https://github.com/microsoft/TypeScript/issues/49160#issuecomment-2032029400).
 *
 * Avoids the deprecated `moduleResolution: "node10"` tsc setting — by
 * omitting `moduleResolution` from tsconfig.cjs.json, tsc emits CJS
 * without triggering TS5107 (deprecation error in TS 5.10+).
 */
import { writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CJS_DIR = join(__dirname, '..', 'dist', 'cjs');

async function main() {
  try {
    await stat(CJS_DIR);
  } catch {
    console.error(`[cjs-pkg] No CJS output at ${CJS_DIR}; skipping.`);
    return;
  }

  const pkgPath = join(CJS_DIR, 'package.json');
  await writeFile(pkgPath, '{"type":"commonjs"}\n', 'utf8');
  console.log(`[cjs-pkg] Wrote ${pkgPath}`);
}

main().catch((err) => {
  console.error('[cjs-pkg] failed:', err);
  process.exit(1);
});
