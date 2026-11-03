/**
 * #5004: the hooks.json generator's main-module guard compared
 * fileURLToPath(import.meta.url) (the module's REAL path) with process.argv[1]
 * (the path as typed). Reached through a symlink, the two differ, so the
 * script exited 0 having written nothing and the plugin build shipped the
 * stale per-handler hooks.json. Run it through a symlink and require output.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import {
  UNIFIED_PRETOOL_HANDLER,
  invokedAsScript,
} from '../../scripts/unified-pretool-hooks.mjs';

const HOOKS_ROOT = resolve(__dirname, '..', '..');
const SCRIPT = join(HOOKS_ROOT, 'scripts', 'unified-pretool-hooks.mjs');
const REGISTRY = join(HOOKS_ROOT, 'hooks.json');

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'unified-hooks-symlink-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function run(scriptPath: string, out: string) {
  return spawnSync(process.execPath, [scriptPath, '--in', REGISTRY, '--out', out], { encoding: 'utf8' });
}

describe('#5004 unified-pretool-hooks runs as a script through any path', () => {
  it('through a symlink: writes the dispatcher hooks.json', () => {
    const link = join(dir, 'gen-link.mjs');
    symlinkSync(SCRIPT, link);
    const out = join(dir, 'hooks.json');

    const r = run(link, out);

    expect(r.status).toBe(0);
    expect(existsSync(out)).toBe(true);
    expect(readFileSync(out, 'utf8')).toContain(UNIFIED_PRETOOL_HANDLER);
  });

  it('through a symlinked directory: writes the dispatcher hooks.json', () => {
    const linkDir = join(dir, 'scripts-link');
    symlinkSync(join(HOOKS_ROOT, 'scripts'), linkDir);
    const out = join(dir, 'hooks.json');

    const r = run(join(linkDir, 'unified-pretool-hooks.mjs'), out);

    expect(r.status).toBe(0);
    expect(readFileSync(out, 'utf8')).toContain(UNIFIED_PRETOOL_HANDLER);
  });

  it('directly: still writes the dispatcher hooks.json', () => {
    const out = join(dir, 'hooks.json');
    expect(run(SCRIPT, out).status).toBe(0);
    expect(readFileSync(out, 'utf8')).toContain(UNIFIED_PRETOOL_HANDLER);
  });
});

describe('invokedAsScript', () => {
  const url = pathToFileURL(SCRIPT).href;

  it('is true for the real path and for a symlink to it', () => {
    const link = join(dir, 'gen-link.mjs');
    symlinkSync(SCRIPT, link);
    expect(invokedAsScript(SCRIPT, url)).toBe(true);
    expect(invokedAsScript(link, url)).toBe(true);
  });

  it('is false for another file, a missing path, or no argv[1]', () => {
    expect(invokedAsScript(REGISTRY, url)).toBe(false);
    expect(invokedAsScript(join(dir, 'missing.mjs'), url)).toBe(false);
    expect(invokedAsScript(undefined, url)).toBe(false);
  });
});
