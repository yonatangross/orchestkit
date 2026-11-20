import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let dist: string;

beforeAll(() => {
  dist = mkdtempSync(join(tmpdir(), 'ork-bundle-sourcemaps-'));
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, ORK_HOOKS_OUT_DIR: dist },
  });
  expect(build.status, build.error?.message ?? build.stderr).toBe(0);
  for (const name of readdirSync(dist)) {
    if (name.endsWith('.map')) rmSync(join(dist, name));
  }
}, 120_000);

afterAll(() => {
  if (dist) rmSync(dist, { recursive: true, force: true });
});

describe('shipped bundle sourcemaps', () => {
  it('does not reference maps excluded from the plugin', () => {
    const bundles = readdirSync(dist).filter(name => name.endsWith('.mjs'));
    expect(bundles.length).toBeGreaterThan(0);
    for (const name of bundles) {
      expect(readFileSync(join(dist, name), 'utf8')).not.toContain('//# sourceMappingURL=');
    }
  });

  it('loads a shipped bundle through the test runner', async () => {
    await expect(import(/* @vite-ignore */ pathToFileURL(join(dist, 'notification.mjs')).href))
      .resolves.toBeDefined();
  });
});
