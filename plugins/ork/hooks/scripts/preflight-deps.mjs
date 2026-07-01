#!/usr/bin/env node
/**
 * preflight-deps.mjs — friendly guard for the direct hooks build/test path.
 *
 * src/hooks is NOT a root npm workspace (workspaces = packages/*), and its
 * node_modules is gitignored (#2645 — a tracked symlink broke 8.60.0). CI
 * installs these deps via the checkout action (install-hooks-deps: true, #2003),
 * and the root `npm run build` degrades gracefully (build-plugins.sh skips the
 * hooks rebuild and ships the tracked dist). But a contributor running
 * `cd src/hooks && npm run build` (or `npm test`) on a fresh clone would
 * otherwise hit a raw `Cannot find package 'esbuild'` stack trace with no hint.
 *
 * This prints the one-line fix and exits non-zero before that happens.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hooksRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// esbuild (build) and vitest (test) both live under the same node_modules.
const sentinels = ['esbuild', 'vitest'];
const missing = sentinels.filter((p) => !existsSync(join(hooksRoot, 'node_modules', p)));

if (missing.length > 0) {
  process.stderr.write(
    `\n✗ src/hooks dependencies are missing (${missing.join(', ')}).\n` +
      `  src/hooks is not a root workspace — install its deps directly:\n\n` +
      `    cd src/hooks && npm ci\n\n` +
      `  (CI does this automatically; the root \`npm run build\` skips the hooks\n` +
      `   rebuild and ships the committed dist when these are absent.)\n\n`,
  );
  process.exit(1);
}
